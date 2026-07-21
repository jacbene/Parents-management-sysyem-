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
  Info,
  Sparkles,
  ThumbsUp,
  Calendar,
  TrendingUp,
  Layers,
  ArrowRight,
  Plus,
  Heart
} from 'lucide-react';
import { ApeeSettings } from '../types';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  category: 'finance' | 'pedagogy' | 'badges' | 'platform';
  status: 'released' | 'in-progress' | 'planned';
  progress: number;
  expectedDate: string;
  impact: 'High' | 'Medium' | 'Normal';
  initialUpvotes: number;
  techDetails?: string[];
}

const DEFAULT_ROADMAP: RoadmapItem[] = [
  {
    id: 'road_momo_auto',
    title: "Paiements Mobiles MoMo/Orange par QR Code instantané",
    description: "Intégration d'un système de scan de QR code sur facture pour initier des invites de paiement USSD directes Orange et MTN.",
    longDescription: "Ce module permettra aux parents d'élèves de flasher un QR code unique de facture imprimée ou affichée à l'écran pour déclencher instantanément une demande de paiement (Push USSD) sur leur téléphone portable MTN ou Orange Money. Le solde APEE sera automatiquement mis à jour et un reçu de paiement certifié PDF sera généré en temps réel, éliminant les temps d'attente au guichet.",
    category: 'finance',
    status: 'released',
    progress: 100,
    expectedDate: 'Disponible - Juin 2026',
    impact: 'High',
    initialUpvotes: 84,
    techDetails: ['Campay Mobile Money API', 'Notification Push USSD', 'Cryptage AES', 'Webhooks en temps réel']
  },
  {
    id: 'road_grades_analysis',
    title: "Relevés scolaires & Bulletins interactifs avec analyses graphiques",
    description: "Tableau de bord dynamique d'évolution des notes par élève et génération automatisée de bulletins certifiés en PDF.",
    longDescription: "Visualisez les performances académiques de vos enfants grâce à des graphiques d'évolution et des comparaisons avec les moyennes de classe par trimestre. Les enseignants peuvent éditer et valider les bulletins de notes scolaires en ligne, et les parents reçoivent une version certifiée par code QR pour vérification d'authenticité.",
    category: 'pedagogy',
    status: 'released',
    progress: 100,
    expectedDate: 'Disponible - Juillet 2026',
    impact: 'High',
    initialUpvotes: 112,
    techDetails: ['D3.js & Recharts Visualizations', 'PDF Generator Engine', 'Calculateur de rang dynamique', 'Signature cryptée']
  },
  {
    id: 'road_sms_presence',
    title: "Notifications SMS instantanées de présence/absence",
    description: "Alerte SMS immédiate envoyée sur le mobile du parent dès le scan du badge QR de l'élève à l'entrée de l'établissement.",
    longDescription: "Dès que le surveillant général scanne le badge d'un élève le matin avec l'application, un système de passerelle SMS (SMS Gateway) transmet instantanément une notification personnalisée au parent. Si l'élève est marqué en retard ou absent injustifié, le parent reçoit des consignes pour régulariser immédiatement la situation, assurant un niveau de sécurité optimal.",
    category: 'badges',
    status: 'in-progress',
    progress: 75,
    expectedDate: 'Fin Juillet 2026',
    impact: 'High',
    initialUpvotes: 148,
    techDetails: ['SMS Gateway API (Twilio/Infobip)', 'Firebase Cloud Functions', 'Gestionnaire de file d\'attente', 'Détection de fuseau horaire']
  },
  {
    id: 'road_chat_parent_teacher',
    title: "Messagerie instantanée Parent-Enseignant intégrée",
    description: "Canal d'échange privé et sécurisé pour discuter du suivi scolaire, des absences et de la discipline de l'élève.",
    longDescription: "Établissez une communication directe, rapide et confidentielle entre les parents et les professeurs principaux. Ce module permet d'envoyer des messages, des fichiers d'évaluation ou des alertes comportementales sans exposer les numéros de téléphone personnels des enseignants, garantissant le respect de la vie privée.",
    category: 'platform',
    status: 'in-progress',
    progress: 40,
    expectedDate: 'Mi-Août 2026',
    impact: 'Medium',
    initialUpvotes: 95,
    techDetails: ['Firestore Real-time Listeners', 'Notification Push de navigateur', 'Modération automatique de contenu', 'Sécurisation de documents']
  },
  {
    id: 'road_offline_pwa',
    title: "Application Mobile Progressive (PWA) & Mode hors-ligne",
    description: "Téléchargement direct du portail sur l'écran d'accueil pour consulter les notes, cours et devoirs sans connexion Internet.",
    longDescription: "Afin de pallier les coupures de réseau fréquentes, ce module transformera le portail en application mobile installable (PWA). Les données précédemment téléchargées (bulletins, cahier de textes, factures APEE payées) resteront accessibles en mode hors-ligne. Les synchronisations s'effectueront automatiquement dès le retour de la connexion.",
    category: 'platform',
    status: 'planned',
    progress: 15,
    expectedDate: 'Rentrée Septembre 2026',
    impact: 'High',
    initialUpvotes: 215,
    techDetails: ['Service Workers', 'Cache Storage API', 'IndexedDB Local Cache', 'Manifeste PWA']
  },
  {
    id: 'road_ai_tutor',
    title: "IA Assistant d'exercice & de remédiation scolaire",
    description: "Module éducatif intelligent proposant des exercices personnalisés basés sur les faiblesses scolaires détectées chez l'élève.",
    longDescription: "Un assistant propulsé par l'IA Gemini 2.5 Flash qui analyse automatiquement les notes trimestrielles de l'élève. Il détecte les matières ou chapitres où l'élève éprouve des difficultés (ex: équations du second degré, grammaire anglaise) et génère de façon dynamique des séances de révision et exercices interactifs de remédiation personnalisés.",
    category: 'pedagogy',
    status: 'planned',
    progress: 5,
    expectedDate: 'Novembre 2026',
    impact: 'Medium',
    initialUpvotes: 173,
    techDetails: ['Gemini 2.5 Flash API', 'Structured JSON Outputs', 'Générateur de quizz', 'Algorithmes adaptatifs d\'apprentissage']
  }
];

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
      const cleanQuery = (searchQuery || '').trim().toLowerCase();
      if (!cleanQuery) return matchesCategory;

      const questionMatches = (faq.question || '').toLowerCase().includes(cleanQuery);
      const tagMatches = (faq.tags || []).some(tag => (tag || '').toLowerCase().includes(cleanQuery));
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

  // --- INTERACTIVE VISUAL ROADMAP STATES & HANDLERS ---
  const [roadmapStatusFilter, setRoadmapStatusFilter] = useState<'all' | 'released' | 'in-progress' | 'planned'>('all');
  const [roadmapCatFilter, setRoadmapCatFilter] = useState<'all' | 'finance' | 'pedagogy' | 'badges' | 'platform'>('all');
  const [expandedRoadmapId, setExpandedRoadmapId] = useState<string | null>(null);
  const [roadmapSearch, setRoadmapSearch] = useState('');
  
  // Voting state: stored in local storage for instant visual reinforcement and state preservation
  const [votedIds, setVotedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pasmasys_voted_roadmap_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [votesCount, setVotesCount] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('pasmasys_roadmap_votes_counts');
      if (saved) return JSON.parse(saved);
    } catch {}
    
    // Fallback to default values
    const init: Record<string, number> = {};
    DEFAULT_ROADMAP.forEach(item => {
      init[item.id] = item.initialUpvotes;
    });
    return init;
  });

  // Suggest a Feature Form State
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestDesc, setSuggestDesc] = useState('');
  const [suggestCat, setSuggestCat] = useState<'finance' | 'pedagogy' | 'badges' | 'platform'>('pedagogy');
  const [isSubmittingSuggest, setIsSubmittingSuggest] = useState(false);
  const [suggestSuccess, setSuggestSuccess] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  // Suggestions submitted in this session (local cache for real-time list update)
  const [localSuggestions, setLocalSuggestions] = useState<{id: string; title: string; description: string; category: string; votes: number}[]>(() => {
    try {
      const saved = localStorage.getItem('pasmasys_local_roadmap_suggestions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleVote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent card expand
    if (votedIds.includes(id)) {
      // Unvote
      const nextVoted = votedIds.filter(vId => vId !== id);
      setVotedIds(nextVoted);
      localStorage.setItem('pasmasys_voted_roadmap_items', JSON.stringify(nextVoted));
      
      const nextVotes = { ...votesCount, [id]: Math.max(0, (votesCount[id] || 0) - 1) };
      setVotesCount(nextVotes);
      localStorage.setItem('pasmasys_roadmap_votes_counts', JSON.stringify(nextVotes));
    } else {
      // Vote
      const nextVoted = [...votedIds, id];
      setVotedIds(nextVoted);
      localStorage.setItem('pasmasys_voted_roadmap_items', JSON.stringify(nextVoted));
      
      const nextVotes = { ...votesCount, [id]: (votesCount[id] || 0) + 1 };
      setVotesCount(nextVotes);
      localStorage.setItem('pasmasys_roadmap_votes_counts', JSON.stringify(nextVotes));
    }
  };

  const handleLocalSuggestVote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (votedIds.includes(id)) {
      const nextVoted = votedIds.filter(vId => vId !== id);
      setVotedIds(nextVoted);
      localStorage.setItem('pasmasys_voted_roadmap_items', JSON.stringify(nextVoted));
      
      const nextSuggests = localSuggestions.map(s => {
        if (s.id === id) {
          return { ...s, votes: Math.max(1, s.votes - 1) };
        }
        return s;
      });
      setLocalSuggestions(nextSuggests);
      localStorage.setItem('pasmasys_local_roadmap_suggestions', JSON.stringify(nextSuggests));
    } else {
      const nextVoted = [...votedIds, id];
      setVotedIds(nextVoted);
      localStorage.setItem('pasmasys_voted_roadmap_items', JSON.stringify(nextVoted));
      
      const nextSuggests = localSuggestions.map(s => {
        if (s.id === id) {
          return { ...s, votes: s.votes + 1 };
        }
        return s;
      });
      setLocalSuggestions(nextSuggests);
      localStorage.setItem('pasmasys_local_roadmap_suggestions', JSON.stringify(nextSuggests));
    }
  };

  const handleAddSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestTitle.trim() || !suggestDesc.trim()) {
      setSuggestError('Veuillez remplir le titre et la description de votre suggestion.');
      return;
    }

    setIsSubmittingSuggest(true);
    setSuggestError('');
    setSuggestSuccess(false);

    const newId = `suggest_${Date.now()}`;

    try {
      // Save directly to Cloud Firestore 'roadmap_suggestions' for durable storage
      await addDoc(collection(db, 'roadmap_suggestions'), {
        title: suggestTitle.trim(),
        description: suggestDesc.trim(),
        category: suggestCat,
        senderName: userEmail || auth.currentUser?.email || 'Visiteur',
        timestamp: new Date().toISOString(),
        upvotes: 1,
        status: 'SUGGESTED',
        schoolName: apeeSettings.associationName || 'CES Ekali'
      });

      // Also store in local state so the user sees their suggested item immediately in the UI
      const newLocal = {
        id: newId,
        title: suggestTitle.trim(),
        description: suggestDesc.trim(),
        category: suggestCat,
        votes: 1
      };
      
      const nextSuggests = [newLocal, ...localSuggestions];
      setLocalSuggestions(nextSuggests);
      localStorage.setItem('pasmasys_local_roadmap_suggestions', JSON.stringify(nextSuggests));
      
      // Mark as voted so they can't double upvote right away
      const nextVoted = [...votedIds, newId];
      setVotedIds(nextVoted);
      localStorage.setItem('pasmasys_voted_roadmap_items', JSON.stringify(nextVoted));

      setSuggestSuccess(true);
      setSuggestTitle('');
      setSuggestDesc('');
    } catch (err: any) {
      console.error('Error submitting suggestion to Firestore:', err);
      // Fallback: Save to local suggestions list even if firestore fails
      const newLocal = {
        id: newId,
        title: suggestTitle.trim(),
        description: suggestDesc.trim(),
        category: suggestCat,
        votes: 1
      };
      const nextSuggests = [newLocal, ...localSuggestions];
      setLocalSuggestions(nextSuggests);
      localStorage.setItem('pasmasys_local_roadmap_suggestions', JSON.stringify(nextSuggests));

      const nextVoted = [...votedIds, newId];
      setVotedIds(nextVoted);
      localStorage.setItem('pasmasys_voted_roadmap_items', JSON.stringify(nextVoted));

      setSuggestSuccess(true);
      setSuggestTitle('');
      setSuggestDesc('');
    } finally {
      setIsSubmittingSuggest(false);
    }
  };

  const handleToggleRoadmapExpand = (id: string) => {
    setExpandedRoadmapId(prev => prev === id ? null : id);
  };

  // Categories helper mapping for roadmap styling
  const getRoadmapCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'finance':
        return { label: 'Finances & Cotisations', icon: Coins, color: 'text-emerald-600 bg-emerald-50 border-emerald-150', border: 'border-l-4 border-l-emerald-500' };
      case 'pedagogy':
        return { label: 'Pédagogie & Notes', icon: BookOpen, color: 'text-amber-600 bg-amber-50 border-amber-150', border: 'border-l-4 border-l-amber-500' };
      case 'badges':
        return { label: 'Badges & Sécurité', icon: QrCode, color: 'text-purple-600 bg-purple-50 border-purple-150', border: 'border-l-4 border-l-purple-500' };
      default:
        return { label: 'Portail & Technique', icon: Layers, color: 'text-sky-600 bg-sky-50 border-sky-150', border: 'border-l-4 border-l-sky-500' };
    }
  };

  const filteredRoadmap = useMemo(() => {
    return DEFAULT_ROADMAP.filter(item => {
      const matchesStatus = roadmapStatusFilter === 'all' || item.status === roadmapStatusFilter;
      const matchesCategory = roadmapCatFilter === 'all' || item.category === roadmapCatFilter;
      const cleanSearch = (roadmapSearch || '').toLowerCase().trim();
      
      const matchesSearch = !cleanSearch || 
        (item.title || '').toLowerCase().includes(cleanSearch) || 
        (item.description || '').toLowerCase().includes(cleanSearch) ||
        (item.techDetails || []).some(tech => (tech || '').toLowerCase().includes(cleanSearch));
        
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [roadmapStatusFilter, roadmapCatFilter, roadmapSearch]);

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

      {/* 4. Interactive Visual Roadmap (Upcoming Portal Updates & Features) */}
      <div className="space-y-6 bg-white border border-slate-150 rounded-3xl p-6 sm:p-8 shadow-xs" id="school_portal_roadmap_section">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1 bg-violet-50 border border-violet-150 text-[10.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-violet-700">
              <Sparkles className="h-3.5 w-3.5" /> Évolution du Portail Pasma-sys
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight font-sans">
              Feuille de Route & Fonctionnalités Futures
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Suivez le déploiement des nouveautés de l'école. Exprimez vos besoins en votant pour vos fonctionnalités préférées ou en proposant de nouvelles idées.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="flex gap-3 text-center shrink-0">
            <div className="px-3 py-2 bg-slate-50 border border-slate-150 rounded-2xl">
              <div className="text-base font-black text-slate-900">
                {DEFAULT_ROADMAP.filter(x => x.status === 'released').length}
              </div>
              <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Livrées</div>
            </div>
            <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-2xl">
              <div className="text-base font-black text-indigo-700">
                {DEFAULT_ROADMAP.filter(x => x.status === 'in-progress').length}
              </div>
              <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">En cours</div>
            </div>
            <div className="px-3 py-2 bg-violet-50 border border-violet-100 rounded-2xl">
              <div className="text-base font-black text-violet-700">
                {DEFAULT_ROADMAP.filter(x => x.status === 'planned').length}
              </div>
              <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Planifiées</div>
            </div>
          </div>
        </div>

        {/* Filters and Searches row */}
        <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Search */}
            <div className="relative lg:col-span-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={roadmapSearch}
                onChange={(e) => setRoadmapSearch(e.target.value)}
                placeholder="Rechercher une mise à jour (ex: SMS, IA)..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-450 focus:outline-hidden focus:ring-1.5 focus:ring-indigo-500 font-medium text-slate-800"
              />
              {roadmapSearch && (
                <button
                  type="button"
                  onClick={() => setRoadmapSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-450 hover:text-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Filters */}
            <div className="lg:col-span-4 flex flex-wrap gap-1.5 select-none items-center">
              <span className="text-[10px] font-bold text-slate-455 uppercase mr-1">Statut:</span>
              <button
                type="button"
                onClick={() => setRoadmapStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                  roadmapStatusFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setRoadmapStatusFilter('released')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                  roadmapStatusFilter === 'released'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-3xs'
                    : 'bg-white text-emerald-600 border-emerald-150 hover:bg-emerald-50'
                }`}
              >
                Déployés
              </button>
              <button
                type="button"
                onClick={() => setRoadmapStatusFilter('in-progress')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                  roadmapStatusFilter === 'in-progress'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs'
                    : 'bg-white text-indigo-650 border-indigo-150 hover:bg-indigo-50'
                }`}
              >
                En cours
              </button>
              <button
                type="button"
                onClick={() => setRoadmapStatusFilter('planned')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                  roadmapStatusFilter === 'planned'
                    ? 'bg-violet-600 text-white border-violet-600 shadow-3xs'
                    : 'bg-white text-violet-650 border-violet-150 hover:bg-violet-50'
                }`}
              >
                Planifiés
              </button>
            </div>

            {/* Category Filters */}
            <div className="lg:col-span-4 flex flex-wrap gap-1.5 select-none items-center">
              <span className="text-[10px] font-bold text-slate-455 uppercase mr-1">Catégorie:</span>
              <button
                type="button"
                onClick={() => setRoadmapCatFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                  roadmapCatFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Toutes
              </button>
              <button
                type="button"
                onClick={() => setRoadmapCatFilter('finance')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                  roadmapCatFilter === 'finance'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Finances
              </button>
              <button
                type="button"
                onClick={() => setRoadmapCatFilter('pedagogy')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                  roadmapCatFilter === 'pedagogy'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Pédagogie
              </button>
              <button
                type="button"
                onClick={() => setRoadmapCatFilter('badges')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                  roadmapCatFilter === 'badges'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Badges
              </button>
              <button
                type="button"
                onClick={() => setRoadmapCatFilter('platform')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                  roadmapCatFilter === 'platform'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Portail
              </button>
            </div>
          </div>
        </div>

        {/* Roadmap Items Visual Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRoadmap.length > 0 ? (
            filteredRoadmap.map(item => {
              const meta = getRoadmapCategoryMeta(item.category);
              const CatIcon = meta.icon;
              const isVoted = votedIds.includes(item.id);
              const currentVotes = votesCount[item.id] || item.initialUpvotes;
              const isExpanded = expandedRoadmapId === item.id;

              return (
                <div 
                  key={item.id}
                  onClick={() => handleToggleRoadmapExpand(item.id)}
                  className={`bg-white border rounded-2xl p-4 transition-all duration-200 hover:shadow-md cursor-pointer relative flex flex-col justify-between ${meta.border} ${
                    isExpanded ? 'border-indigo-500 ring-1 ring-indigo-500/10 shadow-sm' : 'border-slate-150'
                  }`}
                >
                  {/* Status, Category & Upvote row */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      {/* Status pill */}
                      <div>
                        {item.status === 'released' && (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-150 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase">
                            <CheckCircle2 className="h-3 w-3" /> Déployé
                          </span>
                        )}
                        {item.status === 'in-progress' && (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase animate-pulse">
                            <Clock className="h-3 w-3" /> En Cours ({item.progress}%)
                          </span>
                        )}
                        {item.status === 'planned' && (
                          <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-150 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase">
                            <Calendar className="h-3 w-3" /> Planifié
                          </span>
                        )}
                      </div>

                      {/* Interactive Upvote Engine */}
                      <button
                        type="button"
                        onClick={(e) => handleVote(item.id, e)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all duration-150 cursor-pointer ${
                          isVoted
                            ? 'bg-rose-50 text-rose-600 border-rose-200 font-extrabold scale-105 shadow-2xs'
                            : 'bg-slate-50 text-slate-550 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={isVoted ? "Retirer mon vote" : "Soutenir cette mise à jour"}
                      >
                        <Heart className={`h-3.5 w-3.5 transition-transform duration-200 ${isVoted ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold">{currentVotes}</span>
                      </button>
                    </div>

                    {/* Title and Category */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`p-1.5 rounded-lg ${meta.color} shrink-0`}>
                          <CatIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          {meta.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-550 leading-relaxed font-medium">
                        {item.description}
                      </p>
                    </div>

                    {/* Interactive progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                        <span>Avancement</span>
                        <span>{item.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.status === 'released' 
                              ? 'bg-emerald-500' 
                              : item.status === 'in-progress' 
                                ? 'bg-indigo-500' 
                                : 'bg-violet-400'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expansion details with Framer Motion */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden border-t border-slate-100 mt-3 pt-3 space-y-2.5 text-left text-xs"
                      >
                        <p className="text-slate-650 leading-relaxed bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 font-medium">
                          {item.longDescription}
                        </p>

                        {/* Tech Stack used */}
                        {item.techDetails && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Layers className="h-3 w-3" /> Technologies & Modules :
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {item.techDetails.map((tech, i) => (
                                <span key={i} className="text-[9.5px] bg-indigo-50/80 text-indigo-650 px-2 py-0.5 rounded-md font-bold border border-indigo-100/50">
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-500 bg-slate-100/50 px-2.5 py-1.5 rounded-xl">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-450" /> Livraison estimée :
                          </span>
                          <span className="text-slate-800">{item.expectedDate}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Click indicator helper */}
                  <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400 select-none">
                    <span>Impact : {item.impact === 'High' ? '🔴 Élevé' : item.impact === 'Medium' ? '🟡 Moyen' : '🟢 Standard'}</span>
                    <span className="text-indigo-600 hover:underline flex items-center gap-0.5">
                      {isExpanded ? "Moins d'infos" : "Plus d'infos"} <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 bg-slate-50 rounded-2xl border border-slate-150 p-8 text-center space-y-2">
              <Search className="h-6 w-6 text-slate-400 mx-auto" />
              <h4 className="text-xs font-bold text-slate-800">Aucun projet ne correspond à ces filtres</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Modifiez vos filtres de recherche ou sélectionnez une autre catégorie pour consulter nos développements.
              </p>
            </div>
          )}
        </div>

        {/* Custom Parent Suggestions List (Client + Cloud Sync) */}
        {localSuggestions.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 pl-1">
              💡 Vos Suggestions & Idées d'évolution ({localSuggestions.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {localSuggestions.map(sug => {
                const meta = getRoadmapCategoryMeta(sug.category);
                const CatIcon = meta.icon;
                const isVoted = votedIds.includes(sug.id);

                return (
                  <div key={sug.id} className="bg-slate-50/50 border border-slate-150 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-3xs hover:border-slate-300 transition">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`p-1 rounded-md bg-white border border-slate-200 text-slate-600`}>
                          <CatIcon className="h-3 w-3" />
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                          {meta.label}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 truncate">{sug.title}</h4>
                      <p className="text-[11px] text-slate-550 leading-normal line-clamp-2">{sug.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleLocalSuggestVote(sug.id, e)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
                        isVoted 
                          ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-3xs font-extrabold scale-102' 
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                      style={{ width: '42px', height: '48px' }}
                    >
                      <Heart className={`h-3.5 w-3.5 transition-transform ${isVoted ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-400'}`} />
                      <span className="text-[10px] font-black mt-0.5">{sug.votes}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Propose an Idea / Feature Suggestion form */}
        <div className="bg-slate-50/55 rounded-2xl border border-slate-150 p-5 mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Proposer une suggestion d'évolution
              </h3>
              <p className="text-[11px] text-slate-400 leading-tight">
                Vous avez une idée pour simplifier le paiement, l'accès aux bulletins ou la vie scolaire ? Partagez-la !
              </p>
            </div>
          </div>

          {suggestSuccess ? (
            <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-4 text-center space-y-1.5 animate-in fade-in duration-200">
              <p className="text-xs font-bold text-emerald-900">
                🎉 Merci pour votre proposition innovante !
              </p>
              <p className="text-[10.5px] text-emerald-700 leading-normal">
                Votre idée a été enregistrée avec succès. Elle est désormais visible par la communauté et le comité informatique de l'établissement pour évaluation.
              </p>
              <button
                type="button"
                onClick={() => setSuggestSuccess(false)}
                className="text-[10.5px] font-bold text-emerald-600 hover:underline cursor-pointer"
              >
                Soumettre une autre idée
              </button>
            </div>
          ) : (
            <form onSubmit={handleAddSuggestion} className="space-y-3">
              {suggestError && (
                <div className="p-2.5 bg-red-50 border border-red-150 rounded-xl text-[11px] text-red-800">
                  {suggestError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8 space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Titre court de votre idée</label>
                  <input
                    type="text"
                    required
                    value={suggestTitle}
                    onChange={(e) => setSuggestTitle(e.target.value)}
                    placeholder="Ex: Notification instantanée par WhatsApp, Emploi du temps interactif..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Thématique</label>
                  <select
                    value={suggestCat}
                    onChange={(e) => setSuggestCat(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-indigo-500 font-bold text-slate-800"
                  >
                    <option value="finance">Finances & Cotisations</option>
                    <option value="pedagogy">Pédagogie & Notes</option>
                    <option value="badges">Badges & QR Sécurité</option>
                    <option value="platform">Portail & Autres</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Description détaillée de la fonctionnalité</label>
                <textarea
                  required
                  rows={2}
                  value={suggestDesc}
                  onChange={(e) => setSuggestDesc(e.target.value)}
                  placeholder="Décrivez comment cela fonctionne, à qui cela s'adresse et les bénéfices pour l'école..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-indigo-500 font-medium text-slate-800 leading-normal"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingSuggest}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-[11px] transition cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50 active:scale-97"
                >
                  {isSubmittingSuggest ? (
                    <>Envoi en cours...</>
                  ) : (
                    <>
                      <Send className="h-3 w-3" /> Soumettre l'idée
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 5. Write Direct Help Ticket Form (Durable Cloud Persistence) */}
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
