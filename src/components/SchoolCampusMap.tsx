import React, { useState, useMemo, useRef } from 'react';
import { 
  MapPin, 
  Compass, 
  Search, 
  Filter, 
  Navigation, 
  School, 
  GraduationCap, 
  Building2, 
  Users, 
  Phone, 
  Clock, 
  CheckCircle2, 
  Info, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Printer, 
  Share2, 
  Footprints, 
  DoorOpen, 
  HeartPulse, 
  Utensils, 
  Trophy, 
  ShieldCheck, 
  HelpCircle, 
  X, 
  Laptop, 
  BookOpen, 
  CreditCard,
  Building,
  Check,
  Copy,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface CampusFacility {
  id: string;
  code: string;
  name: string;
  category: 'classroom' | 'admin' | 'lab' | 'service' | 'sports' | 'outdoor';
  building: string;
  buildingCode: string;
  floor: string;
  capacity?: number;
  responsiblePerson?: string;
  responsibleTitle?: string;
  contactPhone?: string;
  visitingHours?: string;
  description: string;
  amenities: string[];
  x: number; // Percentage on SVG campus blueprint (0 - 100)
  y: number; // Percentage on SVG campus blueprint (0 - 100)
  color: string;
  routeInstructionsFromGate?: string[];
}

interface SchoolCampusMapProps {
  schoolName?: string;
  schoolYear?: string;
  language?: string;
}

export const DEFAULT_CAMPUS_FACILITIES: CampusFacility[] = [
  // MAIN ENTRANCE & SECURITY
  {
    id: 'fac_gate',
    code: 'ENT-01',
    name: 'Entrée Principale & Poste de Sécurité',
    category: 'service',
    building: 'Portail Principal',
    buildingCode: 'ENT',
    floor: 'Rez-de-chaussée',
    responsiblePerson: 'Agent de Sécurité Nguema',
    responsibleTitle: 'Responsable Accès & Contrôle',
    contactPhone: '+237 677 00 22 33',
    visitingHours: '06h30 - 18h00',
    description: 'Point d\'accès sécurisé obligatoire pour tous les parents, visiteurs et élèves. Contrôle des badges et registre des visites.',
    amenities: ['Accès PMR', 'Caméras de Surveillance', 'Registre Visiteurs', 'Parking Vélos/Motos'],
    x: 12,
    y: 85,
    color: '#059669', // Emerald
    routeInstructionsFromGate: [
      'Vous êtes à l\'Entrée Principale.',
      'Présentez-vous au poste de sécurité pour l\'enregistrement des visites.'
    ]
  },
  // ADMINISTRATION (BATIMENT A)
  {
    id: 'fac_direction',
    code: 'ADM-101',
    name: 'Bureau du Proviseur / Direction',
    category: 'admin',
    building: 'Bâtiment A - Administration',
    buildingCode: 'BAT-A',
    floor: 'Rez-de-chaussée',
    responsiblePerson: 'Marie Béné',
    responsibleTitle: 'Directrice / Proviseur',
    contactPhone: '+237 699 44 55 22',
    visitingHours: 'Mar & Jeu: 09h00 - 13h00 (Sur RDV)',
    description: 'Bureau de la direction générale de l\'établissement. Audiences institutionnelles, inscriptions et partenariats académiques.',
    amenities: ['Salle d\'attente climatisée', 'Secrétariat Général', 'Accès PMR'],
    x: 28,
    y: 35,
    color: '#4f46e5', // Indigo
    routeInstructionsFromGate: [
      'Franchissez le portail principal.',
      'Suivez l\'allée centrale pavée vers la gauche sur 30 mètres.',
      'Montez les 3 marches du Bâtiment A (Administration).',
      'Le bureau de la Direction se trouve sur votre droite (Porte 101).'
    ]
  },
  {
    id: 'fac_apee_desk',
    code: 'ADM-102',
    name: 'Guichet de Cotisation APEE & Caisse',
    category: 'service',
    building: 'Bâtiment A - Administration',
    buildingCode: 'BAT-A',
    floor: 'Rez-de-chaussée',
    responsiblePerson: 'Trésorier APEE',
    responsibleTitle: 'Gestionnaire Financier APEE',
    contactPhone: '+237 655 11 22 33',
    visitingHours: 'Lun au Ven: 07h30 - 15h30',
    description: 'Guichet physique de paiement et de régularisation des cotisations APEE, délivrance des reçus sécurisés et attestations de solde.',
    amenities: ['Caisse Sécurisée', 'Terminal de Paiement Mobile', 'Informatique Directe'],
    x: 22,
    y: 42,
    color: '#2563eb', // Blue
    routeInstructionsFromGate: [
      'Franchissez le portail principal.',
      'Tournez immédiatement à gauche vers le Bâtiment A.',
      'Le Guichet APEE est situé au rez-de-chaussée avec accès direct donnant sur le hall.'
    ]
  },
  // TEACHING BLOCK B (PREMIER CYCLE)
  {
    id: 'fac_cls_6a',
    code: 'B-101',
    name: 'Classe de 6ème A',
    category: 'classroom',
    building: 'Bâtiment B - Premier Cycle',
    buildingCode: 'BAT-B',
    floor: 'Rez-de-chaussée',
    capacity: 45,
    responsiblePerson: 'Mme Ndedi',
    responsibleTitle: 'Professeur Principal 6ème A',
    visitingHours: 'Pause 10h00 - 10h30 & Fin des cours à 15h30',
    description: 'Salle d\'enseignement générale réservée à la classe de 6ème A. Équipée d\'un tableau blanc interactif et de casiers de rangement.',
    amenities: ['Tableau Blanc', 'Vidéoprojecteur', 'Aération optimisée', 'Casier Élèves'],
    x: 52,
    y: 28,
    color: '#7c3aed', // Purple
    routeInstructionsFromGate: [
      'Franchissez le portail principal.',
      'Avancez tout droit le long de la cour centrale.',
      'Dirigez-vous vers le Bâtiment B (Premier Cycle) à votre droite.',
      'Entrez par le hall principal: la Salle 6ème A est la première porte à gauche (B-101).'
    ]
  },
  {
    id: 'fac_cls_5a',
    code: 'B-102',
    name: 'Classe de 5ème A',
    category: 'classroom',
    building: 'Bâtiment B - Premier Cycle',
    buildingCode: 'BAT-B',
    floor: 'Rez-de-chaussée',
    capacity: 48,
    responsiblePerson: 'M. Tchana',
    responsibleTitle: 'Professeur Principal 5ème A',
    visitingHours: 'Mercredi: 11h00 - 12h00',
    description: 'Salle de cours spécialisée pour le niveau 5ème avec affichage didactique et modules de travail de groupe.',
    amenities: ['Tableau Interactif', 'Accès PMR', 'Point d\'eau'],
    x: 62,
    y: 28,
    color: '#7c3aed',
    routeInstructionsFromGate: [
      'Entrez par le portail principal.',
      'Suivez l\'allée vers le Bâtiment B.',
      'Au rez-de-chaussée, prenez le couloir central jusqu\'à la deuxième porte à gauche (B-102).'
    ]
  },
  {
    id: 'fac_cls_3a',
    code: 'B-201',
    name: 'Classe de 3ème A (Préparation BEPC)',
    category: 'classroom',
    building: 'Bâtiment B - Premier Cycle',
    buildingCode: 'BAT-B',
    floor: '1er Étage',
    capacity: 42,
    responsiblePerson: 'M. Ondoa',
    responsibleTitle: 'Professeur Principal 3ème A',
    visitingHours: 'Vendredi: 14h00 - 15h30',
    description: 'Salle de préparation intensive au BEPC. Équipée pour les simulations d\'examens et cours de soutien.',
    amenities: ['Rétroprojecteur', 'Bibliothèque de classe', 'Tableau d\'Honneur'],
    x: 57,
    y: 22,
    color: '#6d28d9',
    routeInstructionsFromGate: [
      'Entrez par le portail principal.',
      'Dirigez-vous vers le Bâtiment B.',
      'Empruntez l\'escalier central jusqu\'au 1er étage.',
      'La salle 3ème A se trouve juste en face de l\'escalier (B-201).'
    ]
  },
  // TEACHING BLOCK C (SECOND CYCLE)
  {
    id: 'fac_cls_2nde',
    code: 'C-101',
    name: 'Classe de 2nde Scientifique (2nde C)',
    category: 'classroom',
    building: 'Bâtiment C - Second Cycle',
    buildingCode: 'BAT-C',
    floor: 'Rez-de-chaussée',
    capacity: 40,
    responsiblePerson: 'Dr. Mbida',
    responsibleTitle: 'Professeur de Mathématiques & PP',
    visitingHours: 'Mardi: 10h00 - 11h30',
    description: 'Salle réservée au Second Cycle Scientifique. Matériel de géométrie et supports de physique-chimie.',
    amenities: ['Vidéoprojecteur HD', 'Prises Électriques', 'Espace Démos'],
    x: 75,
    y: 52,
    color: '#db2777', // Pink/Rose
    routeInstructionsFromGate: [
      'Franchissez le portail principal.',
      'Traversez la cour de récréation vers l\'aile est (Bâtiment C).',
      'La salle 2nde C est la première porte au rez-de-chaussée.'
    ]
  },
  {
    id: 'fac_cls_tle',
    code: 'C-202',
    name: 'Classe de Terminale C & A',
    category: 'classroom',
    building: 'Bâtiment C - Second Cycle',
    buildingCode: 'BAT-C',
    floor: '1er Étage',
    capacity: 38,
    responsiblePerson: 'Mme Etoa',
    responsibleTitle: 'Professeur Principal Terminale',
    visitingHours: 'Sur rendez-vous via le carnet de correspondance',
    description: 'Classe de préparation au Baccalauréat. Espace d\'études silencieux et séances de travaux dirigés.',
    amenities: ['Tableau Numérique', 'Postes de Travail', 'Wifi Pédagogique'],
    x: 82,
    y: 48,
    color: '#be185d',
    routeInstructionsFromGate: [
      'Depuis l\'entrée, rejoignez le Bâtiment C à l\'est du campus.',
      'Montez au 1er étage par l\'escalier extérieur.',
      'Suivez la passerelle couverte vers la porte C-202.'
    ]
  },
  // SPECIAL WING (BATIMENT D - LABS & DIGITAL)
  {
    id: 'fac_computer_lab',
    code: 'LAB-01',
    name: 'Laboratoire d\'Informatique & Multimédia',
    category: 'lab',
    building: 'Bâtiment D - Sciences & Numérique',
    buildingCode: 'BAT-D',
    floor: '1er Étage',
    capacity: 35,
    responsiblePerson: 'Ing. Bikolo',
    responsibleTitle: 'Administrateur Réseau & Enseignant ICT',
    visitingHours: 'Lun au Ven: 08h00 - 16h00',
    description: 'Salle informatique climatisée dotée de 30 ordinateurs connectés à Internet haut débit, imprimante 3D et écran géant de présentation.',
    amenities: ['30 PC sous Windows/Linux', 'Connexion Fibre Optique', 'Climatisation', 'Vidéoprojecteur Ultra-Courte Focale'],
    x: 48,
    y: 62,
    color: '#0284c7', // Sky blue
    routeInstructionsFromGate: [
      'Entrez par le portail principal.',
      'Traversez le jardin central vers le Bâtiment D.',
      'Montez au 1er étage: le Labo Info est sécurisé par un lecteur de badge (Porte LAB-01).'
    ]
  },
  {
    id: 'fac_library',
    code: 'CDI-01',
    name: 'Bibliothèque & Centre de Documentation (CDI)',
    category: 'lab',
    building: 'Bâtiment D - Sciences & Numérique',
    buildingCode: 'BAT-D',
    floor: 'Rez-de-chaussée',
    capacity: 60,
    responsiblePerson: 'Mme Belinga',
    responsibleTitle: 'Documentaliste en Chef',
    visitingHours: 'Lun au Ven: 07h30 - 17h00',
    description: 'Plus de 4 000 ouvrages, romans, encyclopédies, manuels scolaires au programme national et espace de lecture calme pour les élèves.',
    amenities: ['Coin Lecture Ergonomique', 'Ordinateurs de recherche', 'Service d\'Emprunt', 'Espace Presse'],
    x: 38,
    y: 58,
    color: '#0369a1',
    routeInstructionsFromGate: [
      'Entrez par le portail principal.',
      'Tournez légèrement à droite après l\'administration.',
      'Entrez au rez-de-chaussée du Bâtiment D par les grandes portes vitrées.'
    ]
  },
  // AMENITIES & SERVICES
  {
    id: 'fac_infirmary',
    code: 'INF-01',
    name: 'Infirmerie & Poste de Premiers Secours',
    category: 'service',
    building: 'Pavillon Santé',
    buildingCode: 'PAV-S',
    floor: 'Rez-de-chaussée',
    responsiblePerson: 'Infirmière Ebogo',
    responsibleTitle: 'Infirmière Diplômée d\'État',
    contactPhone: '+237 670 11 22 33',
    visitingHours: 'Permanence 24h/24 durant les heures de cours',
    description: 'Service de santé scolaire équipé de 3 lits de repos, trousses de premiers secours, tensiomètres et armoire à pharmacie d\'urgence.',
    amenities: ['3 Lits de Repos', 'Fauteuil Roulant PMR', 'Pharmacie d\'Urgence', 'Point d\'Eau Stérile'],
    x: 18,
    y: 60,
    color: '#dc2626', // Red
    routeInstructionsFromGate: [
      'Entrez par le portail principal.',
      'Prenez l\'allée ombragée immédiatement sur votre gauche.',
      'L\'Infirmerie se trouve dans le pavillon blanc indépendant précédé d\'un petit jardin.'
    ]
  },
  {
    id: 'fac_canteen',
    code: 'RES-01',
    name: 'Cantine & Espace Restauration APEE',
    category: 'service',
    building: 'Espace Restauration',
    buildingCode: 'CAN',
    floor: 'Rez-de-chaussée',
    responsiblePerson: 'Mme Mengue',
    responsibleTitle: 'Gérante Cantine Scolaire',
    visitingHours: '07h00 - 14h30 (Repas chaud de 12h à 13h)',
    description: 'Espace de restauration hygiénique proposant des repas équilibrés contrôlés, boissons fraîches et collations pour élèves et enseignants.',
    amenities: ['Menus Équilibrés', 'Lavabos avec Savon', 'Espace Couvert 150 places', 'Monétique APEE'],
    x: 70,
    y: 80,
    color: '#d97706', // Amber
    routeInstructionsFromGate: [
      'Franchissez le portail principal.',
      'Longez le terrain de sport par le sud.',
      'La Cantine se situe dans le grand hall ouvert près de l\'espace récréatif.'
    ]
  },
  {
    id: 'fac_sports',
    code: 'SPT-01',
    name: 'Terrain de Hand, Basket & Athlétisme',
    category: 'sports',
    building: 'Plateau Sportif Complexe',
    buildingCode: 'SPT',
    floor: 'Plein Air',
    responsiblePerson: 'M. Abena',
    responsibleTitle: 'Chef du Département EPS',
    visitingHours: 'Accessible pendant les cours d\'EPS et tournois APEE',
    description: 'Plateau sportif omnisports comprenant un terrain de Handball, terrain de Basketball, piste d\'athlétisme et vestiaires avec douches.',
    amenities: ['Paniers Réglables', 'Vestiaires Séparés', 'Éclairage Nocturne', 'Piste 200m'],
    x: 45,
    y: 82,
    color: '#16a34a', // Green
    routeInstructionsFromGate: [
      'Entrez par le portail principal.',
      'Continuez tout droit sur l\'allée principale pendant 50 mètres.',
      'Le plateau sportif s\'étend sur tout le centre-sud du campus.'
    ]
  },
  {
    id: 'fac_restrooms',
    code: 'SAN-01',
    name: 'Bloc Sanitaire & Toilettes PMR',
    category: 'service',
    building: 'Bloc Sanitaire Sud',
    buildingCode: 'SAN',
    floor: 'Rez-de-chaussée',
    responsiblePerson: 'Service d\'Entretien Pasma',
    visitingHours: 'Nettoyage continu',
    description: 'Sanitaires modernes séparés Filles / Garçons / Enseignants avec rampes d\'accès PMR et points d\'eau pour le lavage des mains.',
    amenities: ['Cabines PMR', 'Distributeurs de Savon', 'Sèche-mains', 'Accessibilité 100%'],
    x: 85,
    y: 75,
    color: '#0891b2', // Cyan
    routeInstructionsFromGate: [
      'Situé entre le Bâtiment C et la Cantine scolaire.',
      'Suivez les panneaux de signalisation bleus.'
    ]
  }
];

export default function SchoolCampusMap({
  schoolName = "CES d'Ekali 1 - MFOU",
  schoolYear = '2026-2027',
  language = 'fr'
}: SchoolCampusMapProps) {
  const isFr = language === 'fr';

  const [facilities, setFacilities] = useState<CampusFacility[]>(DEFAULT_CAMPUS_FACILITIES);
  const [selectedFacility, setSelectedFacility] = useState<CampusFacility | null>(DEFAULT_CAMPUS_FACILITIES[0]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('all');

  // Interactive Route Finder state
  const [routeStartId, setRouteStartId] = useState<string>('fac_gate');
  const [routeEndId, setRouteEndId] = useState<string>('fac_cls_6a');
  const [isRouteActive, setIsRouteActive] = useState<boolean>(false);

  // Zoom and Pan controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Copy share link / status state
  const [copiedLink, setCopiedLink] = useState(false);

  // Categories config
  const categories = [
    { id: 'all', label: isFr ? 'Tous les lieux' : 'All Facilities', icon: Building },
    { id: 'classroom', label: isFr ? 'Salles de Classe' : 'Classrooms', icon: GraduationCap },
    { id: 'admin', label: isFr ? 'Administration & Direction' : 'Admin Offices', icon: Building2 },
    { id: 'lab', label: isFr ? 'Labos & Numérique' : 'Labs & Digital', icon: Laptop },
    { id: 'service', label: isFr ? 'Services & Guichets' : 'Services & Desk', icon: CreditCard },
    { id: 'sports', label: isFr ? 'Sports & Recreations' : 'Sports & Grounds', icon: Trophy }
  ];

  // Filter facilities
  const filteredFacilities = useMemo(() => {
    return facilities.filter(fac => {
      // Category match
      if (activeCategory !== 'all' && fac.category !== activeCategory) {
        return false;
      }
      // Floor match
      if (selectedFloorFilter !== 'all') {
        if (selectedFloorFilter === 'rc' && !fac.floor.toLowerCase().includes('rez')) return false;
        if (selectedFloorFilter === '1er' && !fac.floor.toLowerCase().includes('1er')) return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = fac.name.toLowerCase().includes(q);
        const matchCode = fac.code.toLowerCase().includes(q);
        const matchBuilding = fac.building.toLowerCase().includes(q);
        const matchDesc = fac.description.toLowerCase().includes(q);
        const matchResp = (fac.responsiblePerson || '').toLowerCase().includes(q);
        return matchName || matchCode || matchBuilding || matchDesc || matchResp;
      }
      return true;
    });
  }, [facilities, activeCategory, selectedFloorFilter, searchQuery]);

  // Route calculation
  const startFacility = useMemo(() => facilities.find(f => f.id === routeStartId) || facilities[0], [facilities, routeStartId]);
  const endFacility = useMemo(() => facilities.find(f => f.id === routeEndId) || facilities[3], [facilities, routeEndId]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 2.2));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.8));
  const handleResetZoom = () => setZoomLevel(1);

  const handlePrintMap = () => {
    window.print();
  };

  const handleCopyMapDetails = async () => {
    if (!selectedFacility) return;
    const details = `📍 LOCATION GUIDE - ${schoolName}\n${selectedFacility.name} (${selectedFacility.code})\nLocation: ${selectedFacility.building} - ${selectedFacility.floor}\nContact: ${selectedFacility.responsiblePerson || 'Secrétariat'} (${selectedFacility.contactPhone || 'N/A'})\nHours: ${selectedFacility.visitingHours || '07:30 - 15:30'}\nNote: ${selectedFacility.description}`;
    try {
      await navigator.clipboard.writeText(details);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-2">
      {/* HEADER BANNER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-black flex items-center gap-1 border border-emerald-300/40">
                <Compass className="h-3.5 w-3.5" />
                <span>{isFr ? 'Carte du Campus & Orientation' : 'Campus Map & Orientation'}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                {schoolYear}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono border border-indigo-200 dark:border-indigo-800">
                {schoolName}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{isFr ? 'Plan Interactif des Salles & Bâtiments' : 'Interactive Campus Map & Facilities'}</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isFr 
                ? `Guide d'accès dynamique pour aider les parents d'élèves, visiteurs et enseignants à se géolocaliser au sein de ${schoolName}.`
                : `Interactive campus blueprint helping parents and visitors easily locate classrooms, administration offices, and services.`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsRouteActive(!isRouteActive)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm ${
                isRouteActive 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
              }`}
            >
              <Footprints className="h-4 w-4" />
              <span>{isRouteActive ? (isFr ? 'Mode Itinéraire Actif' : 'Route Mode Active') : (isFr ? 'Tracer un Itinéraire' : 'Find Walking Route')}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintMap}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              title={isFr ? "Imprimer le plan et guide des salles" : "Print Map"}
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isFr ? 'Imprimer' : 'Print'}</span>
            </button>
          </div>
        </div>

        {/* SEARCH & CATEGORY FILTERS */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isFr ? "Rechercher une salle (ex: 6ème A, Proviseur, Cantine, Labo)..." : "Search room or facility..."}
              className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Categories Pill Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {categories.map(cat => {
              const IconComp = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <IconComp className="h-3.5 w-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROUTE FINDER CONTROLLER BAR (WHEN ACTIVE) */}
      <AnimatePresence>
        {isRouteActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-emerald-900 text-white rounded-2xl p-4 shadow-lg border border-emerald-700/50 relative overflow-hidden"
          >
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-800/80 rounded-xl border border-emerald-600/50 text-emerald-300">
                  <Footprints className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>{isFr ? 'Assistant d\'Itinéraire Piéton' : 'Walking Route Guidance'}</span>
                  </h3>
                  <p className="text-xs text-emerald-200">
                    {isFr ? 'Sélectionnez le point de départ et la salle de destination pour tracer le chemin d\'accès.' : 'Select start and destination to trace your steps on campus.'}
                  </p>
                </div>
              </div>

              {/* Start & End Selectors */}
              <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                <div className="flex items-center gap-1.5 bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-800 text-xs">
                  <span className="text-emerald-400 font-bold">{isFr ? 'Départ :' : 'From:'}</span>
                  <select
                    value={routeStartId}
                    onChange={(e) => setRouteStartId(e.target.value)}
                    className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                  >
                    {facilities.map(f => (
                      <option key={`start_${f.id}`} value={f.id} className="bg-slate-900 text-white">
                        {f.name} ({f.code})
                      </option>
                    ))}
                  </select>
                </div>

                <ArrowRight className="h-4 w-4 text-emerald-400 hidden md:block" />

                <div className="flex items-center gap-1.5 bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-800 text-xs">
                  <span className="text-emerald-300 font-bold">{isFr ? 'Destination :' : 'To:'}</span>
                  <select
                    value={routeEndId}
                    onChange={(e) => setRouteEndId(e.target.value)}
                    className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                  >
                    {facilities.map(f => (
                      <option key={`end_${f.id}`} value={f.id} className="bg-slate-900 text-white">
                        {f.name} ({f.code})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setIsRouteActive(false)}
                  className="p-1.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-200 rounded-lg transition"
                  title="Fermer le mode itinéraire"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT GRID: MAP BLUEPRINT (LEFT 7 COLS) & FACILITY DETAILS/DIRECTORY (RIGHT 5 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* MAP CANVAS / VECTOR BLUEPRINT */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm relative overflow-hidden">
            
            {/* MAP BAR TOOLS */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  {isFr ? 'Plan du Campus (Vue Schématique Vectorielle)' : 'Campus Vector Blueprint'}
                </span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-md font-mono">
                  {filteredFacilities.length} {isFr ? 'lieux répertoriés' : 'locations'}
                </span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition"
                  title={isFr ? "Zoom arrière" : "Zoom out"}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-mono font-bold px-1 text-slate-600 dark:text-slate-300">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition"
                  title={isFr ? "Zoom avant" : "Zoom in"}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 transition border-l border-slate-200 dark:border-slate-700 ml-0.5"
                  title={isFr ? "Réinitialiser la vue" : "Reset view"}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* SVG CAMPUS CONTAINER */}
            <div 
              ref={mapContainerRef}
              className="relative w-full aspect-[4/3] bg-gradient-to-br from-emerald-900/10 via-slate-900/80 to-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner select-none transition-all duration-300"
            >
              {/* Scalable Container */}
              <div 
                className="w-full h-full relative transition-transform duration-200 ease-out origin-center"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                {/* SVG GROUND & BUILDING LAYOUT */}
                <svg className="w-full h-full absolute inset-0" viewBox="0 0 1000 750" fill="none">
                  {/* Grass Grounds Background */}
                  <rect width="1000" height="750" fill="#0f172a" />
                  
                  {/* Courtyard Lawn & Green Zones */}
                  <rect x="50" y="50" width="900" height="650" rx="20" fill="#064e3b" opacity="0.25" />
                  
                  {/* Main Walkway & Paths Grid */}
                  {/* Path Gate to Courtyard */}
                  <path d="M 120 635 L 120 300 L 450 300 L 450 615 L 700 615 L 750 390 L 450 300" stroke="#334155" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                  <path d="M 120 635 L 120 300 L 450 300 L 450 615 L 700 615 L 750 390 L 450 300" stroke="#cbd5e1" strokeWidth="4" strokeDasharray="8 8" strokeLinecap="round" opacity="0.8" />

                  {/* BÂTIMENT A: Administration */}
                  <g className="transition hover:opacity-100">
                    <rect x="220" y="220" width="160" height="130" rx="12" fill="#1e1b4b" stroke="#4338ca" strokeWidth="3" />
                    <text x="300" y="275" fill="#a5b4fc" fontSize="16" fontWeight="bold" textAnchor="middle">BÂTIMENT A</text>
                    <text x="300" y="295" fill="#818cf8" fontSize="12" textAnchor="middle">Direction & APEE</text>
                  </g>

                  {/* BÂTIMENT B: Premier Cycle (6ème - 3ème) */}
                  <g>
                    <rect x="480" y="140" width="220" height="130" rx="12" fill="#2e1065" stroke="#7c3aed" strokeWidth="3" />
                    <text x="590" y="195" fill="#ddd6fe" fontSize="16" fontWeight="bold" textAnchor="middle">BÂTIMENT B</text>
                    <text x="590" y="215" fill="#c4b5fd" fontSize="12" textAnchor="middle">1er Cycle (6e, 5e, 4e, 3e)</text>
                  </g>

                  {/* BÂTIMENT C: Second Cycle (2nde - Tle) */}
                  <g>
                    <rect x="720" y="320" width="180" height="150" rx="12" fill="#831843" stroke="#db2777" strokeWidth="3" />
                    <text x="810" y="385" fill="#fbcfe8" fontSize="16" fontWeight="bold" textAnchor="middle">BÂTIMENT C</text>
                    <text x="810" y="405" fill="#f472b6" fontSize="12" textAnchor="middle">2nd Cycle (2nde, 1ère, Tle)</text>
                  </g>

                  {/* BÂTIMENT D: Sciences & Numérique */}
                  <g>
                    <rect x="360" y="420" width="200" height="120" rx="12" fill="#0c4a6e" stroke="#0284c7" strokeWidth="3" />
                    <text x="460" y="470" fill="#bae6fd" fontSize="16" fontWeight="bold" textAnchor="middle">BÂTIMENT D</text>
                    <text x="460" y="490" fill="#38bdf8" fontSize="12" textAnchor="middle">Labo Info & CDI</text>
                  </g>

                  {/* PLATEAU SPORTIF */}
                  <g>
                    <rect x="380" y="580" width="240" height="110" rx="16" fill="#14532d" stroke="#22c55e" strokeWidth="2" strokeDasharray="6 4" />
                    <circle cx="500" cy="635" r="28" fill="none" stroke="#86efac" strokeWidth="2" />
                    <line x1="500" y1="580" x2="500" y2="690" stroke="#86efac" strokeWidth="2" />
                    <text x="500" y="640" fill="#86efac" fontSize="13" fontWeight="bold" textAnchor="middle">PLATEAU SPORTIF</text>
                  </g>

                  {/* CANTINE & RESTAURATION */}
                  <g>
                    <rect x="660" y="560" width="160" height="100" rx="12" fill="#78350f" stroke="#f59e0b" strokeWidth="2" />
                    <text x="740" y="605" fill="#fde68a" fontSize="14" fontWeight="bold" textAnchor="middle">CANTINE APEE</text>
                    <text x="740" y="625" fill="#fbbf24" fontSize="11" textAnchor="middle">Espace Repas</text>
                  </g>

                  {/* INFIRMERIE */}
                  <g>
                    <rect x="140" y="420" width="120" height="90" rx="10" fill="#7f1d1d" stroke="#ef4444" strokeWidth="2" />
                    <text x="200" y="460" fill="#fca5a5" fontSize="13" fontWeight="bold" textAnchor="middle">INFIRMERIE</text>
                    <path d="M 200 470 L 200 482 M 194 476 L 206 476" stroke="#f87171" strokeWidth="3" strokeLinecap="round" />
                  </g>

                  {/* PORTAIL PRINCIPAL (GATE) */}
                  <g>
                    <rect x="70" y="610" width="100" height="50" rx="8" fill="#064e3b" stroke="#10b981" strokeWidth="3" />
                    <text x="120" y="640" fill="#a7f3d0" fontSize="12" fontWeight="black" textAnchor="middle">ENTRÉE</text>
                  </g>

                  {/* ANIMATED WALKWAY PATH IF ROUTE MODE IS ACTIVE */}
                  {isRouteActive && startFacility && endFacility && (
                    <g>
                      {/* Dynamic SVG route line */}
                      <path
                        d={`M ${startFacility.x * 10} ${startFacility.y * 7.5} Q ${(startFacility.x + endFacility.x) * 5} ${(startFacility.y + endFacility.y) * 3.75} ${endFacility.x * 10} ${endFacility.y * 7.5}`}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="6"
                        strokeDasharray="10 8"
                        className="animate-pulse"
                      />
                      {/* Start Node */}
                      <circle cx={startFacility.x * 10} cy={startFacility.y * 7.5} r="14" fill="#059669" stroke="#ffffff" strokeWidth="3" />
                      <text x={startFacility.x * 10} y={startFacility.y * 7.5 + 4} fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">DEPART</text>
                      
                      {/* End Node */}
                      <circle cx={endFacility.x * 10} cy={endFacility.y * 7.5} r="16" fill="#dc2626" stroke="#ffffff" strokeWidth="3" />
                      <text x={endFacility.x * 10} y={endFacility.y * 7.5 + 4} fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">ARRIVEE</text>
                    </g>
                  )}
                </svg>

                {/* INTERACTIVE PINS LAYER OVER SVG */}
                <div className="absolute inset-0 pointer-events-none">
                  {filteredFacilities.map((fac) => {
                    const isSelected = selectedFacility?.id === fac.id;
                    const isStartNode = isRouteActive && routeStartId === fac.id;
                    const isEndNode = isRouteActive && routeEndId === fac.id;

                    return (
                      <button
                        key={fac.id}
                        type="button"
                        onClick={() => setSelectedFacility(fac)}
                        style={{
                          left: `${fac.x}%`,
                          top: `${fac.y}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                        className={`absolute pointer-events-auto transition-all duration-300 group cursor-pointer focus:outline-none ${
                          isSelected ? 'z-30 scale-125' : 'z-20 hover:scale-110'
                        }`}
                      >
                        {/* Pin Ripple Glow */}
                        {isSelected && (
                          <span className="absolute -inset-2 rounded-full animate-ping opacity-75" style={{ backgroundColor: fac.color }} />
                        )}

                        {/* Main Pin Badge */}
                        <div 
                          className={`px-2.5 py-1 rounded-full text-white text-[11px] font-black flex items-center gap-1 shadow-lg border border-white/40 backdrop-blur-sm whitespace-nowrap ${
                            isSelected ? 'ring-4 ring-white/50 ring-offset-2 ring-offset-slate-900' : ''
                          }`}
                          style={{ backgroundColor: fac.color }}
                        >
                          <MapPin className="h-3 w-3" />
                          <span>{fac.code}</span>
                        </div>

                        {/* Tooltip Hover Badge */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none z-40 bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap">
                          <p className="font-bold">{fac.name}</p>
                          <p className="text-[9px] text-slate-300">{fac.building} • {fac.floor}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* LEGEND BAR BELOW MAP */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] flex-wrap">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-500">{isFr ? 'Légende :' : 'Legend:'}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" /> Administration</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" /> 1er Cycle</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pink-600 inline-block" /> 2nd Cycle</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" /> Labo Info</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Services/Santé</span>
              </div>
              <span className="text-[10px] text-slate-400 italic">
                {isFr ? 'Cliquez sur un repère pour voir la fiche détaillée.' : 'Click pin to view room details.'}
              </span>
            </div>
          </div>
        </div>

        {/* FACILITY DETAIL CARD / DIRECTORY (RIGHT 5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* SELECTED FACILITY DETAILED CARD */}
          {selectedFacility ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
              <div 
                className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-20"
                style={{ backgroundColor: selectedFacility.color }}
              />

              <div className="flex items-start justify-between gap-3 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span 
                      className="px-2.5 py-0.5 rounded-full text-white text-[10px] font-black"
                      style={{ backgroundColor: selectedFacility.color }}
                    >
                      {selectedFacility.code}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-extrabold">
                      {selectedFacility.building}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                      {selectedFacility.floor}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white leading-snug">
                    {selectedFacility.name}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleCopyMapDetails}
                  className={`p-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    copiedLink ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                  title={isFr ? "Copier les détails de la salle" : "Copy room info"}
                >
                  {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                {selectedFacility.description}
              </p>

              {/* KEY INFORMATION GRID */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block">{isFr ? 'Responsable :' : 'Responsible:'}</span>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200 truncate">{selectedFacility.responsiblePerson || 'Secrétariat Général'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{selectedFacility.responsibleTitle || 'Administration'}</p>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block">{isFr ? 'Heures de Réception :' : 'Visiting Hours:'}</span>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-emerald-500" />
                    <span>{selectedFacility.visitingHours || '07h30 - 15h30'}</span>
                  </p>
                </div>
              </div>

              {/* AMENITIES BADGES */}
              {selectedFacility.amenities && selectedFacility.amenities.length > 0 && (
                <div>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                    {isFr ? 'Équipements & Accessibilité :' : 'Amenities & Access:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFacility.amenities.map((item, idx) => (
                      <span 
                        key={idx}
                        className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-lg border border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span>{item}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ROUTE STEP BY STEP INSTRUCTIONS */}
              {selectedFacility.routeInstructionsFromGate && (
                <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-extrabold text-xs">
                    <Footprints className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{isFr ? 'Guide d\'Accès depuis le Portail :' : 'Walking Directions from Gate:'}</span>
                  </div>
                  <ol className="space-y-1.5 pl-1">
                    {selectedFacility.routeInstructionsFromGate.map((step, idx) => (
                      <li key={idx} className="text-[11px] text-indigo-950 dark:text-indigo-300 flex items-start gap-2">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 text-[9px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* QUICK ROUTE LAUNCH BUTTON */}
              <button
                type="button"
                onClick={() => {
                  setRouteEndId(selectedFacility.id);
                  setIsRouteActive(true);
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Footprints className="h-4 w-4" />
                <span>{isFr ? `Tracer l'itinéraire vers ${selectedFacility.code}` : `Get walking route to ${selectedFacility.code}`}</span>
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400">
              <Compass className="h-8 w-8 mx-auto mb-2 opacity-40 animate-spin" />
              <p className="text-xs font-bold">{isFr ? 'Sélectionnez un lieu sur le plan pour afficher sa fiche.' : 'Click any location on the map to view details.'}</p>
            </div>
          )}

          {/* QUICK ROOM DIRECTORY LIST */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <DoorOpen className="h-4 w-4 text-emerald-500" />
                <span>{isFr ? 'Annuaire Rapide des Salles' : 'Quick Room Directory'}</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400">
                {filteredFacilities.length} {isFr ? 'résultats' : 'found'}
              </span>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
              {filteredFacilities.map(fac => {
                const isSelected = selectedFacility?.id === fac.id;
                return (
                  <button
                    key={fac.id}
                    onClick={() => setSelectedFacility(fac)}
                    className={`w-full p-2.5 rounded-xl text-left transition flex items-center justify-between gap-2 border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: fac.color }}
                      />
                      <div className="truncate">
                        <p className="text-xs font-extrabold truncate">{fac.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{fac.building} • {fac.floor}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-600">
                        {fac.code}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
