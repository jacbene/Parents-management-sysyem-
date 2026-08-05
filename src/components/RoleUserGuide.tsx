import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  UserCheck, 
  Coins, 
  QrCode, 
  ShieldCheck, 
  Search, 
  Printer, 
  ExternalLink, 
  CheckCircle2, 
  HelpCircle, 
  ChevronRight, 
  ChevronDown, 
  Info, 
  Sparkles, 
  ArrowRight, 
  Users, 
  GraduationCap, 
  FileText, 
  Lock, 
  Smartphone, 
  Share2, 
  Download,
  KeyRound,
  Bell,
  Calendar,
  Cloud
} from 'lucide-react';
import { ApeeSettings } from '../types';

export type UserRoleType = 'parent' | 'teacher' | 'treasurer' | 'supervisor' | 'admin';

interface RoleUserGuideProps {
  currentRole?: string;
  apeeSettings: ApeeSettings;
  onNavigateToTab?: (tab: string) => void;
  className?: string;
}

interface GuideStep {
  id: string;
  title: string;
  badge: string;
  targetTab?: string;
  summary: string;
  instructions: string[];
  tips?: string[];
  warning?: string;
  icon: any;
}

interface RoleGuide {
  roleId: UserRoleType;
  roleName: string;
  subtitle: string;
  icon: any;
  color: {
    bg: string;
    border: string;
    text: string;
    badge: string;
    gradient: string;
    lightBg: string;
  };
  overview: string;
  keyResponsibilities: string[];
  steps: GuideStep[];
  faq: { question: string; answer: string }[];
}

export default function RoleUserGuide({
  currentRole = 'parent',
  apeeSettings,
  onNavigateToTab,
  className = ''
}: RoleUserGuideProps) {
  // Determine initial role tab based on active portal role
  const getInitialRole = (): UserRoleType => {
    const roleLower = (currentRole || '').toLowerCase();
    if (roleLower.includes('admin') || roleLower.includes('directeur')) return 'admin';
    if (roleLower.includes('teacher') || roleLower.includes('enseignant') || roleLower.includes('prof')) return 'teacher';
    if (roleLower.includes('treasurer') || roleLower.includes('finance') || roleLower.includes('tresorier')) return 'treasurer';
    if (roleLower.includes('supervisor') || roleLower.includes('surveillant') || roleLower.includes('badge')) return 'supervisor';
    return 'parent';
  };

  const [activeRole, setActiveRole] = useState<UserRoleType>(getInitialRole());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [isPrintMode, setIsPrintMode] = useState(false);

  // Role Guides Definition
  const guides: Record<UserRoleType, RoleGuide> = useMemo(() => ({
    parent: {
      roleId: 'parent',
      roleName: "Parent d'Élève & Tuteur",
      subtitle: "Suivi scolaire en temps réel, bulletins, présence et paiement des cotisations APEE",
      icon: Users,
      color: {
        bg: 'bg-indigo-600',
        border: 'border-indigo-200 dark:border-indigo-800',
        text: 'text-indigo-600 dark:text-indigo-400',
        badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        gradient: 'from-indigo-600 to-indigo-800',
        lightBg: 'bg-indigo-50/50 dark:bg-indigo-950/20'
      },
      overview: "En tant que parent ou tuteur légal, le portail vous permet de suivre quotidiennement la scolarité de vos enfants, de payer les cotisations APEE en toute sécurité par Mobile Money, de consulter les notes et devoirs, et de vérifier le statut de présence à l'école.",
      keyResponsibilities: [
        "Consulter les notes trimestrielles et télécharger les bulletins certifiés",
        "Payer les cotisations APEE via Orange Money / MTN Mobile Money (Campay) et télécharger les reçus",
        "Vérifier les présences et retards enregistrés par l'établissement",
        "Accéder au cahier de textes (devoirs) et fiches de leçons publiées par les enseignants",
        "Imprimer ou afficher le badge QR d'identification officiel de votre enfant"
      ],
      steps: [
        {
          id: 'step_parent_1',
          title: "1. Règlement des Cotisations APEE & Factures",
          badge: "Finances & Reçus",
          targetTab: 'billing',
          icon: Coins,
          summary: "Payez la cotisation APEE obligatoire en toute sécurité par Mobile Money ou consultez l'historique des versements.",
          instructions: [
            "Naviguez vers l'onglet 'Facturation & Cotisations' dans le menu principal.",
            "Sélectionnez le nom de votre enfant dans la liste si vous avez plusieurs élèves inscrits.",
            "Cliquez sur le bouton 'Payer par Mobile Money (Orange / MTN)' pour déclencher le paiement sécurisé via l'opérateur Campay.",
            "Saisissez votre numéro de téléphone Mobile Money (ex: 6XXXXXXXX) et validez la notification USSD reçue sur votre téléphone.",
            "Dès la validation, le solde est mis à jour et vous pouvez télécharger votre Reçu Officiel Certifié en PDF."
          ],
          tips: [
            "Les paiements par tranches sont automatiquement comptabilisés et déduits du solde restant.",
            "Conservez vos reçus PDF imprimés ou sauvegardés pour toute démarche administrative."
          ]
        },
        {
          id: 'step_parent_2',
          title: "2. Consultation des Notes & Bulletins Scolaires",
          badge: "Pédagogie & Relevés",
          targetTab: 'grades',
          icon: GraduationCap,
          summary: "Accédez aux résultats d'évaluations, moyennes trimestrielles et bulletins de notes scellés.",
          instructions: [
            "Allez dans l'onglet 'Notes & Bulletins'.",
            "Consultez la grille des matières avec les notes obtenues, les coefficients et les appréciations des professeurs.",
            "Observez le graphique d'évolution pour analyser la progression de l'élève au fil des séquences.",
            "Pour obtenir le bulletin officiel imprimable, cliquez sur 'Générer le Bulletin PDF certifié'."
          ],
          tips: [
            "Chaque bulletin comporte un filigrane et un QR code d'authenticité vérifiable par l'administration."
          ]
        },
        {
          id: 'step_parent_3',
          title: "3. Suivi de Présence & Justification des Absences",
          badge: "Sécurité & Discipline",
          targetTab: 'students_by_class',
          icon: UserCheck,
          summary: "Vérifiez les heures d'arrivée à l'école enregistrées lors du scan du badge de l'élève.",
          instructions: [
            "Accédez à la fiche de votre enfant dans 'Liste par classe' puis sous-onglet 'Présence'.",
            "Visualisez le journal horodaté des entrées, retards et absences.",
            "En cas d'absence injustifiée, contactez directement le Censeur ou le Surveillant Général au numéro indiqué dans le Centre d'aide."
          ]
        },
        {
          id: 'step_parent_4',
          title: "4. Cahier de Textes, Devoirs & Cours",
          badge: "Accompagnement Scolaire",
          targetTab: 'homework',
          icon: BookOpen,
          summary: "Suivez le travail personnel à faire à la maison et téléchargez les supports de cours.",
          instructions: [
            "Allez dans l'onglet 'Cahier de textes' pour consulter la liste des devoirs à rendre avec leurs dates d'échéance.",
            "Consultez l'onglet 'Cours & Leçons' pour réviser les résumés de chapitres transmis par les enseignants."
          ]
        },
        {
          id: 'step_parent_5',
          title: "5. Obtention & Impression du Badge QR Élève",
          badge: "Carte Scolaire",
          targetTab: 'students_by_class',
          icon: QrCode,
          summary: "Générez et imprimez la carte d'identité scolaire munie du code QR infalsifiable.",
          instructions: [
            "Allez dans 'Liste par classe', sélectionnez votre enfant et cliquez sur l'onglet 'Badge QR'.",
            "Cliquez sur 'Imprimer le Badge Scolaire' pour éditer une carte d'identité physique plastifiable."
          ]
        }
      ],
      faq: [
        {
          question: "Que faire si mon paiement Mobile Money a été débité mais le reçu n'apparaît pas ?",
          answer: "L'actualisation s'effectue automatiquement via webhook en quelques secondes. Si nécessaire, cliquez sur le bouton 'Rafraîchir le statut' ou contactez le Trésorier APEE muni de votre référence de transaction."
        },
        {
          question: "Comment puis-je réinitialiser mon mot de passe d'accès ?",
          answer: "Cliquez sur 'Mot de passe oublié' sur l'écran de connexion ou demandez une réinitialisation d'accès à l'administration de l'établissement."
        }
      ]
    },

    teacher: {
      roleId: 'teacher',
      roleName: "Enseignant / Professeur",
      subtitle: "Saisie des notes, gestion du cahier de textes, publication des cours et présence en classe",
      icon: GraduationCap,
      color: {
        bg: 'bg-amber-600',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        gradient: 'from-amber-600 to-amber-800',
        lightBg: 'bg-amber-50/50 dark:bg-amber-950/20'
      },
      overview: "Le rôle d'Enseignant offre un espace de travail complet pour saisir et valider les notes d'évaluations, distribuer des devoirs via le cahier de textes numérique, partager des leçons et enregistrer les présences des élèves.",
      keyResponsibilities: [
        "Saisir les notes d'évaluations et examens par classe et par matière",
        "Publier des devoirs à faire à la maison avec consignes et pièces jointes",
        "Partager des fiches de cours et résumés pédagogiques dans le module Leçons",
        "Prendre les présences en classe et signaler les absences aux surveillants"
      ],
      steps: [
        {
          id: 'step_teacher_1',
          title: "1. Saisie des Notes & Évaluations de Séquence",
          badge: "Notes & Bulletins",
          targetTab: 'grades',
          icon: FileText,
          summary: "Enregistrez les notes obtenues par les élèves pour les devoirs, interrogations et contrôles.",
          instructions: [
            "Accédez à l'onglet 'Notes & Bulletins'.",
            "Sélectionnez la classe et la matière concernée.",
            "Cliquez sur 'Ajouter / Éditer une note' et remplissez la note attribuée sur 20 ainsi que vos remarques pédagogiques.",
            "Si la saisie requiert un déverrouillage, entrez le Code de Validation Académique fourni par la direction."
          ],
          tips: [
            "Vos appréciation individuelles apparaissent directement sur le bulletin de notes téléchargeable par les parents."
          ]
        },
        {
          id: 'step_teacher_2',
          title: "2. Alimentation du Cahier de Textes (Devoirs)",
          badge: "Cahier de textes",
          targetTab: 'homework',
          icon: BookOpen,
          summary: "Programmez des devoirs à faire à la maison avec dates d'échéance précises.",
          instructions: [
            "Naviguez vers l'onglet 'Cahier de textes'.",
            "Cliquez sur le bouton '+ Nouveau Devoir'.",
            "Remplissez le titre, le texte de la consigne, la classe destinataire et la date limite de remise.",
            "Validez l'enregistrement : le devoir devient instantanément visible par les élèves et leurs parents."
          ]
        },
        {
          id: 'step_teacher_3',
          title: "3. Publication des Cours & Leçons",
          badge: "Espace Pédagogique",
          targetTab: 'lessons',
          icon: Sparkles,
          summary: "Déposez des supports de cours théoriques pour guider la révision des élèves.",
          instructions: [
            "Allez sur l'onglet 'Cours & Leçons'.",
            "Cliquez sur '+ Ajouter un cours'.",
            "Rédigez ou collez le contenu structuré du cours et rattachez-le au chapitre du programme officiel."
          ]
        }
      ],
      faq: [
        {
          question: "Que faire si je me suis trompé lors de la saisie d'une note ?",
          answer: "Vous pouvez modifier la note à tout moment depuis le tableau des évaluations. Si la période est verrouillée par la direction, demandez le code d'autorisation au Censeur."
        }
      ]
    },

    treasurer: {
      roleId: 'treasurer',
      roleName: "Trésorier / Gestionnaire Financier APEE",
      subtitle: "Gestion des encaissements, enregistrement des versements, reçus et comptabilité APEE",
      icon: Coins,
      color: {
        bg: 'bg-emerald-600',
        border: 'border-emerald-200 dark:border-emerald-800',
        text: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        gradient: 'from-emerald-600 to-emerald-800',
        lightBg: 'bg-emerald-50/50 dark:bg-emerald-950/20'
      },
      overview: "Le Responsable Financier de l'APEE pilote l'ensemble de la collecte des cotisations, valide les versements au guichet en espèces/chèques, surveille les encaissements automatiques Campay et édite les bilans financiers.",
      keyResponsibilities: [
        "Enregistrer les encaissements manuels en espèces ou virement bancaire",
        "Délivrer et imprimer les reçus officiels certifiés de paiement APEE",
        "Suivre l'état d'avancement du recouvrement par classe et relancer les impayés",
        "Configurer les paramètres de paiement Campay et tarification APEE",
        "Exporter les données comptables et synchroniser avec Google Sheets"
      ],
      steps: [
        {
          id: 'step_treasurer_1',
          title: "1. Saisie d'un Enregistrement de Versement (Guichet)",
          badge: "Caisse & Encaissement",
          targetTab: 'billing',
          icon: Coins,
          summary: "Enregistrez les versements physiques reçus des parents au bureau de la trésorerie.",
          instructions: [
            "Ouvrez l'onglet 'Facturation & Cotisations'.",
            "Recherchez le nom ou le matricule de l'élève à l'aide de la barre de recherche rapide.",
            "Cliquez sur 'Saisir un versement manuel'.",
            "Saisissez le montant perçu (ex: 10 000 XAF) et le mode de règlement (Espèces, Chèque, Dépôt).",
            "Imprimez le Reçu Officiel de Caisse APEE certifié et remettez un exemplaire au parent."
          ],
          tips: [
            "Chaque reçu génère un numéro de souche unique et un QR Code d'audit financier."
          ]
        },
        {
          id: 'step_treasurer_2',
          title: "2. Suivi du Recouvrement & Relance par Classe",
          badge: "Rapports Financiers",
          targetTab: 'billing',
          icon: FileText,
          summary: "Analysez le taux de recouvrement des cotisations APEE et éditez les listes d'impayés.",
          instructions: [
            "Dans le module Facturation, filtrez par classe (ex: 6ème A, 3ème Espagnol).",
            "Consultez les statistiques d'encaissement (Montant total collecté vs Solde restant).",
            "Téléchargez la liste nominale des retardataires de paiement pour diffusion."
          ]
        },
        {
          id: 'step_treasurer_3',
          title: "3. Paramétrage Campay Mobile Money",
          badge: "Configuration API",
          targetTab: 'billing',
          icon: Lock,
          summary: "Configurez l'intégration directe de la passerelle de paiement Mobile Money.",
          instructions: [
            "Ouvrez la modal 'Configuration des Paiements'.",
            "Renseignez vos clés d'API Campay (Username, Password, App Key) obtenues auprès de l'opérateur.",
            "Activez le mode 'Production' pour autoriser les transactions réelles MTN/Orange."
          ]
        }
      ],
      faq: [
        {
          question: "Comment annuler ou corriger une erreur d'encaissement ?",
          answer: "Seul le Trésorier muni du code de déverrouillage de sécurité peut supprimer ou rectifier une entrée de caisse erronée afin d'éviter les fraudes."
        }
      ]
    },

    supervisor: {
      roleId: 'supervisor',
      roleName: "Surveillant Général / Agent de Présence QR",
      subtitle: "Scan des badges QR, contrôle d'accès, suivi des retards et sécurité de l'établissement",
      icon: QrCode,
      color: {
        bg: 'bg-purple-600',
        border: 'border-purple-200 dark:border-purple-800',
        text: 'text-purple-600 dark:text-purple-400',
        badge: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        gradient: 'from-purple-600 to-purple-800',
        lightBg: 'bg-purple-50/50 dark:bg-purple-950/20'
      },
      overview: "Le Surveillant Général utilise l'application pour flasher instantanément les badges QR des élèves lors du franchissement du portail ou de l'entrée en classe, assurant un contrôle rigoureux des retards et absences.",
      keyResponsibilities: [
        "Scanner les badges d'élèves à l'aide de la caméra d'un smartphone ou tablette",
        "Enregistrer automatiquement les statues Présent, Retard ou Absent",
        "Ouvrir la fiche élève scannée pour vérifier la photo et les coordonnées des parents",
        "Déclencher les notifications SMS ou alertes d'absence aux familles"
      ],
      steps: [
        {
          id: 'step_super_1',
          title: "1. Lancement du Scanner de Badges QR",
          badge: "Contrôle d'accès",
          targetTab: 'attendance',
          icon: QrCode,
          summary: "Activez le lecteur QR code de la caméra pour badger les élèves en chaîne.",
          instructions: [
            "Cliquez sur le bouton 'Scanner Badge Élève (QR)' présent dans le menu rapide ou dans l'onglet 'Suivi de Présence'.",
            "Autorisez l'accès à la caméra de votre appareil mobile si le navigateur le demande.",
            "Orientez l'objectif vers le QR code imprimé sur la carte de l'élève.",
            "Un bip sonore de confirmation et un signal vert valident le badgeage de l'élève à l'heure exacte."
          ],
          tips: [
            "Vous pouvez utiliser la caméra arrière d'un téléphone ou un lecteur de code-barres USB raccordé à un ordinateur."
          ]
        },
        {
          id: 'step_super_2',
          title: "2. Consultation de la Fiche Élève après Scan",
          badge: "Fiche d'Identité",
          targetTab: 'students_by_class',
          icon: UserCheck,
          summary: "Accédez en 1 clic aux informations de l'élève directement depuis l'écran du scanner.",
          instructions: [
            "Une fois le badge scanné, cliquez sur le bouton 'Ouvrir la fiche de l'élève'.",
            "Vérifiez l'identité visuelle de l'élève, son groupe classe et le numéro de téléphone du tuteur.",
            "Modifiez le statut de présence ou saisissez un motif de retard si nécessaire."
          ]
        }
      ],
      faq: [
        {
          question: "Que faire si l'élève a oublié ou perdu son badge QR ?",
          answer: "Recherchez son nom manuellement dans la liste nominative 'Liste par Classe' et pointez sa présence. Vous pouvez également réimprimer son badge instantanément."
        }
      ]
    },

    admin: {
      roleId: 'admin',
      roleName: "Administrateur & Directeur d'Établissement",
      subtitle: "Supervision globale, gestion des accès, sauvegardes Cloud et annonces officielles",
      icon: ShieldCheck,
      color: {
        bg: 'bg-sky-600',
        border: 'border-sky-200 dark:border-sky-800',
        text: 'text-sky-600 dark:text-sky-400',
        badge: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        gradient: 'from-sky-600 to-sky-800',
        lightBg: 'bg-sky-50/50 dark:bg-sky-950/20'
      },
      overview: "L'Administrateur possède les privilèges complets pour paramétrer les données de l'école, inscrire et gérer les effectifs d'élèves, gérer les comptes, créer des communiqués et superviser la sécurité Cloud.",
      keyResponsibilities: [
        "Configurer le profil de l'établissement (Nom, Année Scolaire, Cotisation APEE)",
        "Gérer les inscriptions d'élèves, affectations de classe et ré-enrôlements",
        "Publier des communiqués et circulaires officielles sur le flux d'annonces",
        "Accéder à la console SuperAdmin, aux exports Google Drive et Google Sheets",
        "Définir les mots de passe de déverrouillage de sécurité pour les opérations sensibles"
      ],
      steps: [
        {
          id: 'step_admin_1',
          title: "1. Configuration Initiale & Mots de Passe de Sécurité",
          badge: "Administration & Sécurité",
          targetTab: 'apee_settings',
          icon: KeyRound,
          summary: "Définissez les réglages fondamentaux de l'école et sécurisez la plateforme.",
          instructions: [
            "Accédez à l'onglet 'Réglages APEE / Établissement'.",
            "Mettez à jour le nom de l'association APEE, l'année scolaire en cours (ex: 2026/2027) et les contacts des responsables.",
            "Définissez le 'Mot de passe d'approbation académique' pour protéger la saisie des notes et paiements."
          ]
        },
        {
          id: 'step_admin_2',
          title: "2. Gestion des Élèves & Inscriptions par Classe",
          badge: "Effectifs & Classes",
          targetTab: 'students_by_class',
          icon: Users,
          summary: "Inscrivez les nouveaux élèves, attribuez leurs classes et générez leurs badges.",
          instructions: [
            "Ouvrez 'Liste par Classe'.",
            "Cliquez sur '+ Inscrire un nouvel élève'.",
            "Complétez la fiche d'état civil, affectez la classe (ex: 6ème A, 3ème B) et associez le tuteur légal."
          ]
        },
        {
          id: 'step_admin_3',
          title: "3. Diffusion d'Annonces & Communiqués Officiels",
          badge: "Communication",
          targetTab: 'announcements',
          icon: Bell,
          summary: "Diffusez des convocations d'assemblée générale ou notes de service aux parents.",
          instructions: [
            "Allez dans l'onglet 'Communiqués & Annonces'.",
            "Cliquez sur 'Nouvelle Annonce'.",
            "Saisissez le titre, le corps du message et la priorité (Urgent / Info).",
            "L'annonce apparaît immédiatement sur le tableau de bord de tous les parents."
          ]
        },
        {
          id: 'step_admin_4',
          title: "4. Intégrations Google Workspace & Sauvegardes",
          badge: "Cloud & Export",
          targetTab: 'google_drive',
          icon: Cloud,
          summary: "Synchronisez vos registres scolaires avec Google Drive et Google Sheets.",
          instructions: [
            "Consultez l'onglet 'Google Drive & Sauvegardes'.",
            "Effectuez des sauvegardes intégrales au format JSON ou exportez les données d'élèves vers Google Sheets."
          ]
        }
      ],
      faq: [
        {
          question: "Comment réinitialiser totalement les données en début d'année scolaire ?",
          answer: "Depuis la console SuperAdmin, effectuez une sauvegarde intégrale préalable, puis utilisez l'outil de basculement d'année scolaire pour archiver les données passées."
        }
      ]
    }
  }), []);

  const activeGuide = guides[activeRole];

  // Filtering steps based on search query
  const filteredSteps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return activeGuide.steps;

    return activeGuide.steps.filter(step => {
      const matchTitle = step.title.toLowerCase().includes(query);
      const matchSummary = step.summary.toLowerCase().includes(query);
      const matchInstructions = step.instructions.some(i => i.toLowerCase().includes(query));
      const matchBadge = step.badge.toLowerCase().includes(query);
      return matchTitle || matchSummary || matchInstructions || matchBadge;
    });
  }, [activeGuide, searchQuery]);

  return (
    <div className={`space-y-6 max-w-5xl mx-auto text-slate-800 ${className}`} id="role_user_guide_printable">
      <style>{`
        @media print {
          /* Hide all page content outside the guide */
          body * {
            visibility: hidden !important;
          }
          
          #role_user_guide_printable, #role_user_guide_printable * {
            visibility: visible !important;
          }
          
          #role_user_guide_printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
          }

          .no-print, .no-print-interface {
            display: none !important;
          }

          .print-show-all {
            display: block !important;
            height: auto !important;
            opacity: 1 !important;
            visibility: visible !important;
          }

          .print-card {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Clean Printable Document Header (Visible only when printing) */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-indigo-600 font-sans">
        <div className="flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">
              <BookOpen className="h-4 w-4" />
              <span>Guide d'Utilisation Officiel - Pasma-sys & APEE</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Mode d'Emploi : {activeGuide.roleName}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Établissement : <strong>{apeeSettings.associationName || 'CES Ekali'}</strong> | Année Scolaire : <strong>{apeeSettings.schoolYear || '2026/2027'}</strong>
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            Document d'utilisation officiel<br />
            Imprimé le : {new Date().toLocaleDateString('fr-FR')}
          </div>
        </div>
      </div>

      {/* Top Banner Header (On-screen interface) */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-xl relative overflow-hidden no-print-interface">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/40 px-3 py-1 rounded-full text-xs font-bold text-indigo-300">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Guide d'Utilisation Officiel & Mode d'Emploi</span>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl border border-indigo-500 transition cursor-pointer flex items-center gap-2 shadow-md active:scale-97"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimer le Guide ({activeGuide.roleName.split('&')[0]})</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-sans">
              Mode d'Emploi par Rôle & Fonctionnalités
            </h1>
            <p className="text-slate-350 text-xs sm:text-sm font-medium leading-relaxed max-w-3xl">
              Chaque utilisateur dispose d'un espace adapté à ses responsabilités dans l'établissement {apeeSettings.associationName || 'CES Ekali'}. Sélectionnez votre rôle ci-dessous pour découvrir le guide pas-à-pas et accéder rapidement aux modules.
            </p>
          </div>

          {/* Role Switcher Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 no-print-interface">
            {(Object.keys(guides) as UserRoleType[]).map((roleKey) => {
              const guide = guides[roleKey];
              const RoleIcon = guide.icon;
              const isSelected = activeRole === roleKey;

              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => {
                    setActiveRole(roleKey);
                    setExpandedStepId(null);
                  }}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col items-center sm:items-start gap-1.5 ${
                    isSelected 
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-2 ring-indigo-400/30' 
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <RoleIcon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    {currentRole.toLowerCase().includes(roleKey) && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Votre Rôle
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black truncate w-full text-center sm:text-left">
                    {guide.roleName.split('&')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Role Content Header & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-2xs print-card">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-150 dark:border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl text-white ${activeGuide.color.bg} shadow-sm shrink-0 no-print-interface`}>
              <activeGuide.icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {activeGuide.roleName}
                </h2>
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${activeGuide.color.badge} no-print-interface`}>
                  {activeGuide.roleId}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {activeGuide.subtitle}
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-72 no-print-interface">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une étape (ex: reçu, bulletin, note)..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs placeholder-slate-400 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1.5 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>

        {/* Overview & Key Responsibilities */}
        <div className={`p-4 rounded-2xl border ${activeGuide.color.border} ${activeGuide.color.lightBg} space-y-3 print-card`}>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            {activeGuide.overview}
          </p>
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1.5">
              🎯 Missions Principales :
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {activeGuide.keyResponsibilities.map((resp, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-650 dark:text-slate-350">
                  <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${activeGuide.color.text}`} />
                  <span>{resp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>📋 Guide Pas-à-Pas des Fonctionnalités</span>
            <span className="text-[11px] font-normal text-slate-400 no-print-interface">
              {filteredSteps.length} {filteredSteps.length > 1 ? 'étapes' : 'étape'}
            </span>
          </h3>

          <div className="space-y-3">
            {filteredSteps.map((step) => {
              const StepIcon = step.icon;
              const isExpanded = expandedStepId === step.id;

              return (
                <div 
                  key={step.id} 
                  className="bg-slate-50/70 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs print-card"
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs shrink-0 mt-0.5 sm:mt-0 no-print-interface">
                        <StepIcon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            {step.title}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full">
                            {step.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                          {step.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0 no-print-interface">
                      {step.targetTab && onNavigateToTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateToTab(step.targetTab!)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-97"
                        >
                          <span>Accéder</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Instructions Detail (Expanded on screen or automatically visible on print) */}
                  <div className={`px-5 pb-5 pt-2 border-t border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 space-y-3 print-card ${
                    isExpanded ? 'block' : 'hidden print:block print-show-all'
                  }`}>
                    <div className="space-y-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                        Instructions détaillées :
                      </span>
                      <ol className="space-y-1.5 pl-1">
                        {step.instructions.map((inst, i) => (
                          <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 leading-relaxed">
                            <span className="h-4 w-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span>{inst}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {step.tips && step.tips.length > 0 && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1 text-xs text-amber-900 dark:text-amber-200 print-card">
                        <span className="font-bold flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-amber-600 no-print-interface" /> Astuce Pratique :
                        </span>
                        {step.tips.map((tip, tIdx) => (
                          <p key={tIdx} className="text-[11.5px] leading-snug pl-4">
                            • {tip}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Role Specific FAQ */}
        {activeGuide.faq && activeGuide.faq.length > 0 && (
          <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-indigo-500 no-print-interface" />
              <span>Questions Fréquentes pour ce Rôle</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeGuide.faq.map((faqItem, fIdx) => (
                <div key={fIdx} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-1.5 print-card">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-start gap-1.5">
                    <span className="text-indigo-500 font-black">Q:</span> {faqItem.question}
                  </h4>
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-350 leading-relaxed pl-4">
                    {faqItem.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
