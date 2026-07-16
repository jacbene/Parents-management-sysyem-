import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  X, 
  HelpCircle, 
  Phone, 
  User, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Coins, 
  Shield, 
  QrCode, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Info
} from 'lucide-react';
import { ApeeSettings } from '../types';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

interface SchoolHelpCenterProps {
  apeeSettings: ApeeSettings;
  portalUserRole: string;
  onNavigateToTab?: (tab: any) => void;
  userEmail?: string;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string | ((settings: ApeeSettings) => React.ReactNode);
  category: 'finance' | 'pedagogy' | 'security' | 'badges';
  tags: string[];
}

export default function SchoolHelpCenter({
  apeeSettings,
  portalUserRole,
  onNavigateToTab,
  userEmail = ''
}: SchoolHelpCenterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'finance' | 'pedagogy' | 'security' | 'badges'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Help ticket state
  const [ticketName, setTicketName] = useState('');
  const [ticketPhone, setTicketPhone] = useState('');
  const [ticketSubject, setTicketSubject] = useState('finance');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Static + Dynamic FAQs list
  const faqs: FAQItem[] = useMemo(() => [
    {
      id: 'faq_1',
      category: 'finance',
      tags: ['cotisation', 'paiement', 'argent', 'finance', 'reglement', 'apee', 'tarif', 'frais'],
      question: "Quel est le montant de la cotisation de l'APEE et comment la régler ?",
      answer: (settings) => (
        <div className="space-y-2">
          <p>
            Pour l'année scolaire <strong className="text-indigo-705">{settings.schoolYear || '2026/2027'}</strong>, la cotisation obligatoire de l'APEE de l'établissement s'élève à <strong>{(settings.cotisationAmount || 0).toLocaleString()} {settings.currency || 'XAF'}</strong> par élève enregistré.
          </p>
          <p>
            Vous pouvez régler cette somme :
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-650">
            <li><strong>En ligne (Recommandé) :</strong> Directement via votre Espace Parent dans l'onglet <button onClick={() => onNavigateToTab?.('billing')} className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5">Facturation <ExternalLink className="h-3 w-3" /></button> avec Campay (Orange Money / MTN Mobile Money).</li>
            <li><strong>Au guichet :</strong> Auprès du Responsable Financier, <strong>{settings.finManagerName || "le Trésorier"}</strong> ({settings.finManagerPhone || "Non renseigné"}), muni du matricule ou du badge de l'élève.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'faq_2',
      category: 'finance',
      tags: ['paiement partiel', 'tranche', 'avance', 'versement', 'credit'],
      question: "Puis-je effectuer des paiements partiels de la cotisation ?",
      answer: (settings) => (
        <p>
          Oui. Notre système gère nativement les paiements par tranche ou versements multiples. Chaque versement est instantanément enregistré et déduit du solde restant. Vous pouvez consulter l'état précis de votre compte et télécharger vos reçus officiels depuis l'onglet <button onClick={() => onNavigateToTab?.('billing')} className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5">Facturation <ExternalLink className="h-3 w-3" /></button>.
        </p>
      )
    },
    {
      id: 'faq_3',
      category: 'pedagogy',
      tags: ['notes', 'bulletin', 'notes scolaires', 'evaluation', 'notes de classe'],
      question: "Comment consulter les notes et les bulletins de mon enfant ?",
      answer: () => (
        <p>
          Toutes les évaluations continues, notes de séquences et bulletins trimestriels sont saisis en temps réel par les enseignants. Pour y accéder, naviguez vers l'onglet <button onClick={() => onNavigateToTab?.('grades')} className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5">Notes & Bulletins <ExternalLink className="h-3 w-3" /></button>. Vous y trouverez un tableau interactif affichant les moyennes par matière ainsi que la possibilité d'exporter les relevés officiels sous format PDF.
        </p>
      )
    },
    {
      id: 'faq_4',
      category: 'badges',
      tags: ['badge', 'qr code', 'scan', 'presence', 'entree', 'absence'],
      question: "À quoi sert le badge QR Code de l'élève et comment est-il utilisé ?",
      answer: () => (
        <div className="space-y-2">
          <p>
            Le badge scolaire contient un code QR cryptographique unique associé au profil numérique de l'élève. Il offre deux usages majeurs :
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-slate-650">
            <li><strong>Contrôle de présence automatisé :</strong> À l'entrée ou en classe, le surveillant ou l'enseignant scanne le QR code du badge avec l'application. Cela enregistre instantanément le statut de présence et notifie le parent en temps réel.</li>
            <li><strong>Sécurisation :</strong> Il certifie l'identité officielle de l'élève au sein de l'établissement.</li>
          </ol>
          <p className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 text-slate-500">
            💡 Astuce : Les parents peuvent visualiser et imprimer le badge de leur enfant directement depuis la fiche élève dans l'onglet "Liste par classe".
          </p>
        </div>
      )
    },
    {
      id: 'faq_5',
      category: 'pedagogy',
      tags: ['devoir', 'cahier de textes', 'exercice', 'leçon', 'travail', 'maison'],
      question: "Où trouver les devoirs à faire et le cahier de textes de l'école ?",
      answer: () => (
        <p>
          Pour accompagner l'élève dans son travail quotidien, rendez-vous sur l'onglet <button onClick={() => onNavigateToTab?.('homework')} className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5">Cahier de textes <ExternalLink className="h-3 w-3" /></button>. Les devoirs y sont répertoriés par matière avec leur date d'échéance, consignes détaillées et pièces jointes éventuelles. Les cours théoriques sont également disponibles dans l'onglet <button onClick={() => onNavigateToTab?.('lessons')} className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5">Cours & Leçons <ExternalLink className="h-3 w-3" /></button>.
        </p>
      )
    },
    {
      id: 'faq_6',
      category: 'security',
      tags: ['securite', 'mot de passe', 'compte', 'connexion', 'deverrouillage', 'responsable'],
      question: "Pourquoi certaines actions demandent-elles un déverrouillage académique ?",
      answer: (settings) => (
        <p>
          Afin de garantir la stricte intégrité des données financières de l'établissement et d'éviter les modifications accidentelles, les opérations sensibles (saisie de notes, modification de présence, dépenses APEE) sont protégées par le mot de passe d'accès du <strong>Responsable Académique {settings.pedManagerName && `(${settings.pedManagerName})`}</strong> ou du Trésorier. Seuls les agents habilités possèdent ce code d'approbation.
        </p>
      )
    },
    {
      id: 'faq_7',
      category: 'pedagogy',
      tags: ['absence', 'retard', 'justificatif', 'justifier', 'presence', 'excuse'],
      question: "Que faire si mon enfant est absent ou en retard ?",
      answer: (settings) => (
        <p>
          Toute absence constatée génère une notification sur votre espace. Vous devez obligatoirement soumettre un justificatif ou prendre contact avec le Surveillant Général ou le Responsable Académique, <strong>{settings.pedManagerName || "le Directeur Académique"}</strong> au <strong>{settings.pedManagerPhone || "votre numéro d'école"}</strong> afin de régulariser la situation de l'élève.
        </p>
      )
    },
    {
      id: 'faq_8',
      category: 'security',
      tags: ['sauvegarde', 'google drive', 'donnees', 'excel', 'backup', 'cloud'],
      question: "Comment sont sécurisées et sauvegardées les données de notre établissement ?",
      answer: () => (
        <p>
          Toutes les données de notre portail sont stockées de façon sécurisée et durable sur le cloud Firebase. De plus, les administrateurs ont accès au module <button onClick={() => onNavigateToTab?.('google_drive')} className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5">Google Drive & Sauvegardes <ExternalLink className="h-3 w-3" /></button> permettant d'archiver automatiquement des instantanés au format JSON ou de les lister dans Google Sheets en temps réel.
        </p>
      )
    }
  ], [onNavigateToTab]);

  // Categories helper
  const categories = [
    { id: 'all', label: 'Toutes les questions', icon: HelpCircle, color: 'bg-indigo-50 border-indigo-150 text-indigo-700' },
    { id: 'finance', label: 'Cotisations & Tarifs', icon: Coins, color: 'bg-emerald-50 border-emerald-150 text-emerald-700' },
    { id: 'pedagogy', label: 'Espace Pédagogique', icon: BookOpen, color: 'bg-amber-50 border-amber-150 text-amber-700' },
    { id: 'badges', label: 'Badges & QR Codes', icon: QrCode, color: 'bg-purple-50 border-purple-150 text-purple-700' },
    { id: 'security', label: 'Accès & Sécurité', icon: Shield, color: 'bg-sky-50 border-sky-150 text-sky-700' },
  ];

  // Filtering FAQ list based on Search and Selected Category
  const filteredFaqs = useMemo(() => {
    return faqs.filter(faq => {
      const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
      const cleanQuery = searchQuery.trim().toLowerCase();
      if (!cleanQuery) return matchesCategory;

      const questionMatches = faq.question.toLowerCase().includes(cleanQuery);
      const tagMatches = faq.tags.some(tag => tag.toLowerCase().includes(cleanQuery));
      return matchesCategory && (questionMatches || tagMatches);
    });
  }, [faqs, searchQuery, activeCategory]);

  // Submit help ticket to Firestore
  const handleSendTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketName.trim() || !ticketMessage.trim()) {
      setSubmitError('Veuillez remplir votre nom et votre message.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      // Save directly to 'help_requests' collection in Firestore
      await addDoc(collection(db, 'help_requests'), {
        senderName: ticketName.trim(),
        senderPhone: ticketPhone.trim(),
        senderEmail: userEmail || auth.currentUser?.email || '',
        subject: ticketSubject,
        message: ticketMessage.trim(),
        timestamp: new Date().toISOString(),
        status: 'OPEN',
        userRole: portalUserRole,
        schoolName: apeeSettings.associationName || 'CES Ekali'
      });

      setSubmitSuccess(true);
      setTicketName('');
      setTicketPhone('');
      setTicketMessage('');
    } catch (err: any) {
      console.error('Error submitting help ticket:', err);
      setSubmitError("Une erreur est survenue lors de l'envoi de votre question. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-1 text-slate-800" id="school_help_center_view">
      {/* 1. Header Hero Area with Search */}
      <div className="relative rounded-3xl bg-slate-900 overflow-hidden text-white border border-slate-800 shadow-xl">
        {/* Subtle Decorative Background Lines */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-transparent to-slate-950/20" />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-2xl" />

        <div className="relative p-6 sm:p-10 space-y-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1 bg-indigo-500/15 border border-indigo-500/35 px-3 py-1 rounded-full text-xs font-bold text-indigo-300">
              <HelpCircle className="h-3.5 w-3.5" /> Centre d'assistance interactif
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-none font-sans">
              Comment pouvons-nous vous aider aujourd'hui ?
            </h1>
            <p className="text-slate-350 text-xs sm:text-sm font-medium leading-relaxed">
              Consultez les réponses immédiates ci-dessous ou prenez contact directement avec le personnel administratif de l'école.
            </p>
          </div>

          {/* Large Search Input */}
          <div className="relative max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par mot-clé (ex: cotisation, bulletin, badge, mot de passe...)"
              className="w-full pl-11 pr-11 py-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-sm placeholder-slate-450 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-white transition font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Key Administration Contacts Widget */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-550 flex items-center gap-1.5 pl-1">
          🏫 Personnel de Direction & Contacts Administratifs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Financial Director Card */}
          <div className="bg-white border border-slate-150 rounded-2xl p-4 flex items-start gap-4 hover:border-indigo-150 transition shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100/50 text-indigo-650">
              <Coins className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500">
                Gestion Administrative & Cotisations APEE
              </span>
              <h3 className="text-sm font-black text-slate-900 truncate">
                {apeeSettings.finManagerName || "Le Trésorier de l'École"}
              </h3>
              <p className="text-xs text-slate-500 leading-tight">
                Pour toutes les requêtes concernant les règlements de scolarité, reçus fiscaux, relances et finances.
              </p>
              {apeeSettings.finManagerPhone ? (
                <a
                  href={`tel:${apeeSettings.finManagerPhone}`}
                  className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-xs font-extrabold px-3 py-1.5 rounded-xl hover:bg-slate-100 transition text-slate-700 cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-600" /> Appeler : {apeeSettings.finManagerPhone}
                </a>
              ) : (
                <span className="text-[11px] text-slate-400 italic font-medium flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-slate-350" /> Aucun téléphone renseigné dans les réglages.
                </span>
              )}
            </div>
          </div>

          {/* Academic Director Card */}
          <div className="bg-white border border-slate-150 rounded-2xl p-4 flex items-start gap-4 hover:border-indigo-150 transition shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100/50 text-indigo-650">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500">
                Suivi Académique, Présences & Devoirs
              </span>
              <h3 className="text-sm font-black text-slate-900 truncate">
                {apeeSettings.pedManagerName || "Le Responsable Académique (Censeur/Surveillant)"}
              </h3>
              <p className="text-xs text-slate-500 leading-tight">
                Pour justifier une absence d'élève, signaler une note incorrecte ou discuter du cahier de textes.
              </p>
              {apeeSettings.pedManagerPhone ? (
                <a
                  href={`tel:${apeeSettings.pedManagerPhone}`}
                  className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-xs font-extrabold px-3 py-1.5 rounded-xl hover:bg-slate-100 transition text-slate-700 cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-600" /> Appeler : {apeeSettings.pedManagerPhone}
                </a>
              ) : (
                <span className="text-[11px] text-slate-400 italic font-medium flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-slate-350" /> Aucun téléphone renseigné dans les réglages.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Categories and FAQ Items */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-550 pl-1">
            🙋 Questions les plus fréquentes (FAQ)
          </h2>
          {searchQuery && (
            <span className="text-xs font-extrabold text-indigo-650 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
              {filteredFaqs.length} {filteredFaqs.length > 1 ? 'résultats trouvés' : 'résultat trouvé'}
            </span>
          )}
        </div>

        {/* Category Pill Filters */}
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 select-none">
          {categories.map(cat => {
            const Icon = cat.icon;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id as any);
                  setExpandedId(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-full border transition cursor-pointer shrink-0 ${
                  isSelected 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-2.5">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map(faq => {
              const isExpanded = expandedId === faq.id;
              return (
                <div 
                  key={faq.id} 
                  className="bg-white border border-slate-150 rounded-2xl overflow-hidden transition-all duration-200 hover:border-slate-300 shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(faq.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left font-black text-slate-800 hover:bg-slate-50/50 transition cursor-pointer select-none"
                  >
                    <span className="text-xs sm:text-sm font-bold pr-4 flex items-start gap-2.5">
                      <HelpCircle className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                      {faq.question}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: 'easeInOut' }}
                      >
                        <div className="px-12 pb-5 text-xs sm:text-[13px] text-slate-600 border-t border-slate-100 pt-3 leading-relaxed">
                          {typeof faq.answer === 'function' ? faq.answer(apeeSettings) : faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          ) : (
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-8 text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-slate-200/50 flex items-center justify-center mx-auto text-slate-400">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-black text-slate-800">
                Aucun résultat trouvé pour votre recherche
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Essayez d'utiliser des termes plus simples (ex: "notes", "tranche", "frais") ou effacez la recherche pour voir toutes les catégories.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
                className="mt-2 text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                Effacer la recherche
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Write Direct Help Ticket Form (Durable Cloud Persistence) */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 shadow-xs">
        <div className="lg:col-span-5 space-y-4">
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-xs font-black px-2.5 py-1 rounded-full text-indigo-700">
            ✉️ Formulaire d'assistance
          </span>
          <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none font-sans">
            Vous ne trouvez pas de réponse ?
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Envoyez un message direct et personnalisé aux responsables de l'école. Votre demande sera enregistrée de manière sécurisée et une réponse vous sera fournie dans les plus brefs délais sur votre messagerie ou par téléphone.
          </p>
          <div className="p-3.5 bg-white border border-slate-150 rounded-2xl space-y-2 text-[11px] text-slate-550 font-medium">
            <span className="font-extrabold text-slate-800 uppercase flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-indigo-650" /> Temps de traitement
            </span>
            <p className="leading-tight">
              Les demandes sont examinées du lundi au vendredi de 08h00 à 15h30. Une alerte SMS ou e-mail est automatiquement déclenchée lors du traitement.
            </p>
          </div>
        </div>

        {/* The Form */}
        <div className="lg:col-span-7">
          {submitSuccess ? (
            <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-6 text-center space-y-3.5">
              <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-emerald-950">
                  Question transmise avec succès !
                </h3>
                <p className="text-xs text-emerald-800 max-w-sm mx-auto leading-relaxed">
                  Votre ticket d'assistance a été enregistré de façon permanente dans la base de données Pasma-sys de l'école. L'administration vous contactera très rapidement.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubmitSuccess(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs active:scale-97"
              >
                Envoyer une autre demande
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendTicket} className="space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-slate-600 uppercase">Votre nom complet</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={ticketName}
                      onChange={(e) => setTicketName(e.target.value)}
                      placeholder="Ex: TCHAMENI Alain"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-indigo-500 font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-slate-600 uppercase">Numéro de téléphone</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="tel"
                      value={ticketPhone}
                      onChange={(e) => setTicketPhone(e.target.value)}
                      placeholder="Ex: 6XXXXXXXX"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-indigo-500 font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-600 uppercase">Sujet de votre question</label>
                <select
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-indigo-500 font-bold text-slate-800"
                >
                  <option value="finance">Cotisations APEE & Factures de scolarité</option>
                  <option value="pedagogy">Contrôle académique, Devoirs & Notes</option>
                  <option value="badges">Enrôlement ou perte de Badge QR d'élève</option>
                  <option value="access">Problème de mot de passe ou d'accès au portail</option>
                  <option value="other">Autre demande générale</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-600 uppercase">Votre message</label>
                <textarea
                  required
                  rows={4}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Décrivez précisément votre demande ou votre question..."
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-indigo-500 font-medium text-slate-800 leading-normal"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
              >
                {isSubmitting ? (
                  <>Transmission en cours...</>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" /> Transmettre ma question
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
