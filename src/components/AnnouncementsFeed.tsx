import React, { useState } from 'react';
import { Announcement, AnnouncementCategory } from '../types';
import { Newspaper, Bell, Award, Calendar, AlertTriangle, Plus, Trash2, Shield, Lock, Unlock, CheckCircle, Volume2, VolumeX, Pin, FileText, FileUp, File, Eye, EyeOff, Image as ImageIcon, ArrowRight, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../utils/TranslationContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

const STATIC_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann_1',
    title: 'Réunion d\'information - Classes de Découverte',
    content: 'Chers parents, nous vous invitons à la réunion de présentation des classes vertes le vendredi 5 juin à 18h00 dans la grande salle polyvalente de l\'école. Présence recommandée.',
    category: 'Event',
    date: '2026-05-23',
    author: 'Direction de l\'Établissement',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'ann_ad_1',
    title: '📚 -15% sur les Fournitures Scolaires chez PapetVogt',
    content: 'Préparez la rentrée sereinement ! Présentez votre reçu de paiement de cotisation APEE PasmaSys sur l\'application pour bénéficier d\'une réduction immédiate de 15% sur tous les manuels scolaires et sacs à dos.',
    category: 'Sponsored',
    date: '2026-05-21',
    author: 'Librairie & Papeterie Vogt',
    isSponsored: true,
    sponsorName: 'PapetVogt Sarl',
    sponsorLink: 'https://example.com/papetvogt-promo',
    sponsorBadgeText: 'Promo Rentrée 2026',
    adClicks: 142,
    adImpressions: 2150,
    imageUrl: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'ann_2',
    title: 'Sécurité Routière et Accès École',
    content: 'Suite aux travaux dans la rue des Écoles, nous rappelons que le dépose-minute est temporairement déplacé devant la mairie. Merci de respecter la signalisation pour la sécurité des enfants.',
    category: 'Urgent',
    date: '2026-05-20',
    author: 'Bureau de la Sécurité Scolaire'
  },
  {
    id: 'ann_ad_2',
    title: '🚌 Transport Scolaire Sécurisé - TransScol Vogt',
    content: 'Il reste 12 places disponibles pour nos navettes de ramassage scolaire pour l\'année académique en cours. Chauffeurs professionnels certifiés, climatisation, et géo-localisation en temps réel pour rassurer les parents.',
    category: 'Sponsored',
    date: '2026-05-19',
    author: 'TransScol Vogt SA',
    isSponsored: true,
    sponsorName: 'TransScol Group',
    sponsorLink: 'https://example.com/transscol-inscription',
    sponsorBadgeText: 'Ramassage 2026',
    adClicks: 89,
    adImpressions: 1850,
    imageUrl: 'https://images.unsplash.com/photo-1557223562-6c77ef16210f?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'ann_3',
    title: 'Fête de l\'École 2026 - Préparatifs',
    content: 'La grande kermesse de fin d\'année aura lieu le samedi 27 juin. Nous recherchons des parents bénévoles pour tenir les stands et amener des gâteaux. Inscrivez-vous auprès de l\'association des parents !',
    category: 'General',
    date: '2026-05-18',
    author: 'Association Parents GPE'
  },
  {
    id: 'ann_4',
    title: 'Bilan de Santé Scolaire - CP et CE2',
    content: 'Les visites médicales obligatoires débuteront le mois prochain. Un carnet de rendez-vous individuel et un questionnaire de santé confidentiel vous parviendront par le cahier de liaison de votre enfant.',
    category: 'Academic',
    date: '2026-05-15',
    author: 'Infirmerie Scolaire',
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    pdfFileName: 'Fiche_Sante_Confidentielle_CP_CE2.pdf'
  }
];

interface AnnouncementsFeedProps {
  customAnnouncements?: Announcement[];
  onAddAnnouncement?: (ann: Announcement) => Promise<boolean>;
  onDeleteAnnouncement?: (id: string) => Promise<boolean>;
  onTogglePinAnnouncement?: (id: string, pinned: boolean) => Promise<boolean>;
  isPedAuthorized?: boolean;
  onPromptUnlockPed?: () => void;
  pedManagerName?: string;
  hasPedPassword?: boolean;
}

export default function AnnouncementsFeed({
  customAnnouncements = [],
  onAddAnnouncement,
  onDeleteAnnouncement,
  onTogglePinAnnouncement,
  isPedAuthorized = false,
  onPromptUnlockPed,
  pedManagerName = '',
  hasPedPassword = false,
}: AnnouncementsFeedProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('General');
  const [author, setAuthor] = useState(pedManagerName || 'Responsable Pédagogique');
  const [speakingAnnId, setSpeakingAnnId] = useState<string | null>(null);
  const [deleteAnnConfirmId, setDeleteAnnConfirmId] = useState<string | null>(null);
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);
  const resumeIntervalRef = React.useRef<any>(null);

  const [localPinnedIds, setLocalPinnedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pasma_pinned_announcements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isPinnedForm, setIsPinnedForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Image attachments
  const [imageSourceType, setImageSourceType] = useState<'upload' | 'url'>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageFileError, setImageFileError] = useState('');
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  // PDF attachments
  const [pdfSourceType, setPdfSourceType] = useState<'upload' | 'url'>('upload');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrlInput, setPdfUrlInput] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfFileError, setPdfFileError] = useState('');
  const pdfInputRef = React.useRef<HTMLInputElement>(null);

  const [activePdfAnnId, setActivePdfAnnId] = useState<string | null>(null);

  // States for Sponsored Ads
  const [adClicksMap, setAdClicksMap] = useState<Record<string, number>>({});
  const [sponsorNameInput, setSponsorNameInput] = useState('');
  const [sponsorLinkInput, setSponsorLinkInput] = useState('');
  const [sponsorBadgeInput, setSponsorBadgeInput] = useState('');

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageFileError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageFileError(isEn ? 'Please select a valid image file.' : 'Veuillez sélectionner un fichier image valide.');
      return;
    }

    // Max size: 10 MB for Firebase Storage uploads
    if (file.size > 10 * 1024 * 1024) {
      setImageFileError(isEn ? 'Image is too large. Max size: 10 MB.' : 'L\'image est trop volumineuse. Taille max conseillée : 10 Mo.');
      return;
    }

    setImageFile(file);
    setImageFileName(file.name);
    
    // Create lightweight object URL for immediate browser preview
    try {
      const localUrl = URL.createObjectURL(file);
      setImageUrlInput(localUrl);
    } catch (err) {
      console.warn("Failed to create object URL:", err);
    }
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdfFileError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setPdfFileError(isEn ? 'Please select a PDF document.' : 'Veuillez sélectionner un document PDF.');
      return;
    }

    // Max size: 10 MB for Firebase Storage uploads
    if (file.size > 10 * 1024 * 1024) {
      setPdfFileError(isEn ? 'PDF is too large. Max size: 10 MB.' : 'Le PDF est trop volumineux. Taille max conseillée : 10 Mo.');
      return;
    }

    setPdfFile(file);
    setPdfFileName(file.name);

    // Create lightweight object URL for immediate browser preview
    try {
      const localUrl = URL.createObjectURL(file);
      setPdfUrlInput(localUrl);
    } catch (err) {
      console.warn("Failed to create object URL:", err);
    }
  };

  const handleRemoveImage = () => {
    if (imageUrlInput.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(imageUrlInput);
      } catch (err) {
        console.warn("Error revoking URL:", err);
      }
    }
    setImageFile(null);
    setImageUrlInput('');
    setImageFileName('');
    setImageFileError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleRemovePdf = () => {
    if (pdfUrlInput.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(pdfUrlInput);
      } catch (err) {
        console.warn("Error revoking URL:", err);
      }
    }
    setPdfFile(null);
    setPdfUrlInput('');
    setPdfFileName('');
    setPdfFileError('');
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  // Stop talking on unmount and preload/warm up voices in background
  React.useEffect(() => {
    if ('speechSynthesis' in window) {
      // Pre-warm the voice list
      window.speechSynthesis.getVoices();
      
      const handleVoicesChanged = () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.getVoices();
        }
      };
      
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        if (resumeIntervalRef.current) {
          clearInterval(resumeIntervalRef.current);
        }
        window.speechSynthesis.cancel();
      };
    }
  }, []);

  const handleSpeakAnnouncement = (id: string, title: string, content: string) => {
    if (!('speechSynthesis' in window)) {
      alert(isEn ? 'Speech synthesis is not supported on this browser.' : 'La synthèse vocale n\'est pas supportée par votre appareil.');
      return;
    }

    // Nettoyer les intervalles précédents
    if (resumeIntervalRef.current) {
      clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = null;
    }

    // Si c'est la même annonce qui est en cours de lecture, on arrête
    if (speakingAnnId === id) {
      window.speechSynthesis.cancel();
      setSpeakingAnnId(null);
      utteranceRef.current = null;
      return;
    }

    // Arrêter toute lecture en cours
    window.speechSynthesis.cancel();
    setSpeakingAnnId(null);
    utteranceRef.current = null;

    // Délai de sécurité pour permettre à speechSynthesis.cancel() de libérer le canal audio
    setTimeout(() => {
      try {
        // Nettoyer le texte
        const cleanTitle = title.replace(/[#*_`~[\]]/g, '');
        const cleanContent = content.replace(/[#*_`~[\]]/g, '');
        
        // Créer l'utterance
        const utterance = new SpeechSynthesisUtterance(`${cleanTitle}. ${cleanContent}`);
        utteranceRef.current = utterance;
        
        // Définir les paramètres
        utterance.rate = 0.95; // Rythme naturel
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        const preferredLang = language === 'en' ? 'en' : 'fr';
        const defaultLang = language === 'en' ? 'en-US' : 'fr-FR';
        utterance.lang = defaultLang;

        // Sélectionner et configurer la voix de manière extrêmement synchrone et résiliente avant speak()
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          // 1. Chercher d'abord une voix locale (localService === true) dans la langue préférée
          let voice = voices.find(v => 
            v.localService && 
            ((v.lang || '').toLowerCase().startsWith(preferredLang) || (v.lang || '').toLowerCase().includes(preferredLang))
          );

          // 2. Si non trouvée, chercher n'importe quelle voix dans la langue préférée (locale ou cloud)
          if (!voice) {
            voice = voices.find(v => 
              (v.lang || '').toLowerCase().startsWith(preferredLang) || (v.lang || '').toLowerCase().includes(preferredLang)
            );
          }

          // 3. Si non trouvée, chercher par nom contenant des mots-clés de la langue préférée
          if (!voice) {
            voice = voices.find(v => 
              preferredLang === 'fr' 
                ? ((v.name || '').toLowerCase().includes('french') || (v.name || '').toLowerCase().includes('français'))
                : ((v.name || '').toLowerCase().includes('english') || (v.name || '').toLowerCase().includes('us') || (v.name || '').toLowerCase().includes('uk'))
            );
          }

          // 4. Si non trouvée, chercher une voix locale de l'autre langue
          if (!voice) {
            const otherLang = preferredLang === 'fr' ? 'en' : 'fr';
            voice = voices.find(v => 
              v.localService && 
              ((v.lang || '').toLowerCase().startsWith(otherLang) || (v.lang || '').toLowerCase().includes(otherLang))
            );
          }

          // 5. Si non trouvée, chercher n'importe quelle voix de l'autre langue
          if (!voice) {
            const otherLang = preferredLang === 'fr' ? 'en' : 'fr';
            voice = voices.find(v => 
              (v.lang || '').toLowerCase().startsWith(otherLang) || (v.lang || '').toLowerCase().includes(otherLang)
            );
          }

          // 6. Si toujours non trouvée, chercher n'importe quelle voix locale disponible
          if (!voice) {
            voice = voices.find(v => v.localService);
          }

          // 7. Ultime recours : la voix par défaut ou la première voix de la liste
          if (!voice) {
            voice = voices.find(v => v.default) || voices[0];
          }

          if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang; // Force la langue de l'utterance à correspondre exactement à la voix pour éviter les conflits
            console.log('Voice selected for announcement speech:', voice.name, voice.lang, 'local:', voice.localService);
          }
        }

        // Événements
        utterance.onstart = () => {
          console.log('Speech started for:', id);
          setSpeakingAnnId(id);
          
          // Keep-alive interval pour Chrome pour éviter que l'utterance s'arrête au bout de 15s
          resumeIntervalRef.current = setInterval(() => {
            if (window.speechSynthesis.speaking) {
              window.speechSynthesis.resume();
              console.log('Resuming speech (keep-alive)...');
            } else {
              clearInterval(resumeIntervalRef.current);
              resumeIntervalRef.current = null;
            }
          }, 5000);
        };

        utterance.onend = () => {
          console.log('Speech ended for:', id);
          if (utteranceRef.current === utterance) {
            if (resumeIntervalRef.current) {
              clearInterval(resumeIntervalRef.current);
              resumeIntervalRef.current = null;
            }
            setSpeakingAnnId(null);
            utteranceRef.current = null;
          }
        };

        utterance.onerror = (e) => {
          console.warn('Speech synthesis warning:', e.error || e);
          
          // Only clean up state if this error belongs to the active utterance
          if (utteranceRef.current === utterance) {
            if (resumeIntervalRef.current) {
              clearInterval(resumeIntervalRef.current);
              resumeIntervalRef.current = null;
            }
            setSpeakingAnnId(null);
            utteranceRef.current = null;
          }

          // Avoid showing alert or handling errors if it is an expected cancellation/interruption
          if (e.error !== 'interrupted' && e.error !== 'canceled') {
            if (e.error === 'not-allowed') {
              alert(isEn 
                ? "Your browser blocked text-to-speech. Please click the page and try again, or use the 'Open in new tab' button." 
                : "Votre navigateur a bloqué la synthèse vocale. Veuillez cliquer sur la page et réessayer, ou utiliser le bouton 'Ouvrir dans un nouvel onglet'."
              );
            } else if (e.error === 'network') {
              alert(isEn 
                ? "Network error with speech synthesis. Please try again." 
                : "Erreur réseau avec la synthèse vocale. Veuillez réessayer."
              );
            }
          }
        };

        // S'assurer que la synthèse n'est pas en pause
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        
        window.speechSynthesis.speak(utterance);
        
        // Forcer la reprise immédiate pour Chrome
        setTimeout(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.resume();
          }
        }, 50);

      } catch (err) {
        console.error('Failed to speak:', err);
        setSpeakingAnnId(null);
        utteranceRef.current = null;
        alert(isEn 
          ? "Failed to start speech. Please try again." 
          : "Impossible de démarrer la lecture vocale. Veuillez réessayer."
        );
      }
    }, 150); // Petit délai suffisant de 150ms pour que cancel() libère le thread
  };

  // Merge custom dynamic announcements with static ones
  const allAnnouncements = [...customAnnouncements, ...STATIC_ANNOUNCEMENTS];

  const sortedAnnouncements = [...allAnnouncements].sort((a, b) => {
    const aPinned = !!(a.pinned || localPinnedIds.includes(a.id));
    const bPinned = !!(b.pinned || localPinnedIds.includes(b.id));
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const handleTogglePin = async (id: string, currentlyPinned: boolean) => {
    if (hasPedPassword && !isPedAuthorized && onPromptUnlockPed) {
      onPromptUnlockPed();
      return;
    }
    
    const newPinned = !currentlyPinned;
    let updatedIds = [...localPinnedIds];
    if (newPinned) {
      if (!updatedIds.includes(id)) {
        updatedIds.push(id);
      }
    } else {
      updatedIds = updatedIds.filter(x => x !== id);
    }
    setLocalPinnedIds(updatedIds);
    try {
      localStorage.setItem('pasma_pinned_announcements', JSON.stringify(updatedIds));
    } catch (e) {
      console.warn("Could not save pinned announcements to localStorage:", e);
    }

    if (onTogglePinAnnouncement) {
      await onTogglePinAnnouncement(id, newPinned);
    }
  };

  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case 'Urgent':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          badge: 'bg-red-100 text-red-800',
          icon: AlertTriangle
        };
      case 'Event':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          badge: 'bg-indigo-100 text-indigo-800',
          icon: Calendar
        };
      case 'Academic':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          badge: 'bg-emerald-100 text-emerald-800',
          icon: Award
        };
      case 'Sponsored':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200/80',
          badge: 'bg-amber-100 text-amber-900 border border-amber-300/40',
          icon: Sparkles
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          badge: 'bg-slate-100 text-slate-800',
          icon: Bell
        };
    }
  };

  const handleOpenForm = () => {
    if (hasPedPassword && !isPedAuthorized && onPromptUnlockPed) {
      onPromptUnlockPed();
      return;
    }
    setAuthor(pedManagerName || 'Direction / Censeur');
    setShowAddForm(true);
    setIsPinnedForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Veuillez remplir le titre et le contenu du communiqué.');
      return;
    }

    setIsUploading(true);

    try {
      let finalImageUrl = imageUrlInput.trim() || undefined;
      let finalPdfUrl = pdfUrlInput.trim() || undefined;

      // Handle image file upload to Firebase Storage
      if (imageSourceType === 'upload' && imageFile) {
        try {
          const imageRef = ref(storage, `announcements/images/${Date.now()}_${imageFile.name}`);
          await uploadBytes(imageRef, imageFile);
          finalImageUrl = await getDownloadURL(imageRef);
        } catch (storageError) {
          console.error("Firebase Storage image upload failed:", storageError);
          setImageFileError(isEn ? "Failed to upload image to Firebase Storage." : "Échec du téléversement de l'image vers Firebase Storage.");
          setIsUploading(false);
          return;
        }
      }

      // Handle PDF file upload to Firebase Storage
      if (pdfSourceType === 'upload' && pdfFile) {
        try {
          const documentRef = ref(storage, `announcements/documents/${Date.now()}_${pdfFile.name}`);
          await uploadBytes(documentRef, pdfFile);
          finalPdfUrl = await getDownloadURL(documentRef);
        } catch (storageError) {
          console.error("Firebase Storage PDF upload failed:", storageError);
          setPdfFileError(isEn ? "Failed to upload PDF to Firebase Storage." : "Échec du téléversement du PDF vers Firebase Storage.");
          setIsUploading(false);
          return;
        }
      }

      if (onAddAnnouncement) {
        const isSpon = category === 'Sponsored';
        const newAnn: Announcement = {
          id: 'ann_' + Date.now(),
          title: title.trim(),
          content: content.trim(),
          category,
          date: new Date().toISOString().split('T')[0],
          author: author.trim() || 'Responsable Pédagogique',
          pinned: isPinnedForm,
          imageUrl: finalImageUrl,
          pdfUrl: finalPdfUrl,
          pdfFileName: pdfFileName.trim() || undefined,
          isSponsored: isSpon,
          sponsorName: isSpon ? (sponsorNameInput.trim() || 'Partenaire Officiel') : undefined,
          sponsorLink: isSpon ? (sponsorLinkInput.trim() || 'https://example.com') : undefined,
          sponsorBadgeText: isSpon ? (sponsorBadgeInput.trim() || 'Sponsorisé') : undefined,
          adClicks: isSpon ? 0 : undefined,
          adImpressions: isSpon ? 1 : undefined,
        };

        const success = await onAddAnnouncement(newAnn);
        if (success) {
          setTitle('');
          setContent('');
          setIsPinnedForm(false);
          setImageFile(null);
          setImageUrlInput('');
          setImageFileName('');
          setImageFileError('');
          setPdfFile(null);
          setPdfUrlInput('');
          setPdfFileName('');
          setPdfFileError('');
          setSponsorNameInput('');
          setSponsorLinkInput('');
          setSponsorBadgeInput('');
          setShowAddForm(false);
        }
      }
    } catch (err) {
      console.error("Submission failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, annTitle: string) => {
    if (hasPedPassword && !isPedAuthorized && onPromptUnlockPed) {
      onPromptUnlockPed();
      return;
    }
    setDeleteAnnConfirmId(id);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-150 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-indigo-600" />
            Annonces & Actualités de l'École
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Toutes les communications officielles diffusées par l'administration de l'établissement.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              window.open(window.location.href, '_blank');
            }}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="h-3 w-3" />
            {isEn ? "Open in new tab for audio" : "Ouvrir dans un nouvel onglet pour l'audio"}
          </button>

          <button
            onClick={handleOpenForm}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" /> Publier un Communiqué
          </button>
        </div>
      </div>

      {/* Security Status Header */}
      {hasPedPassword && (
        <div className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isPedAuthorized ? 'bg-emerald-50 text-emerald-950 border-emerald-150' : 'bg-slate-50 text-slate-800 border-slate-150'
        }`}>
          <div className="flex items-center gap-2">
            {isPedAuthorized ? (
              <Unlock className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="h-4.5 w-4.5 text-slate-500 shrink-0" />
            )}
            <div>
              <span className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide text-[10px] text-slate-650">
                {isPedAuthorized ? '🔓 Accès Officiel Débloqué' : '🔒 Consultation (Saisies Verrouillées)'}
              </span>
              <p className="font-medium text-slate-600 mt-0.5">
                {isPedAuthorized 
                  ? `Vous écrivez en tant que : ${pedManagerName || "Principal Responsable Pédagogique"}`
                  : `La modification des communiqués nécessite le mot de passe du Surveillant Général / Censeur.`}
              </p>
            </div>
          </div>
          {!isPedAuthorized && onPromptUnlockPed && (
            <button
              onClick={onPromptUnlockPed}
              className="px-3 py-1.5 bg-white text-slate-800 border border-slate-250 font-bold rounded-lg text-[10px] hover:bg-slate-50 uppercase tracking-wider transition cursor-pointer shrink-0"
            >
              Saisir mot de passe
            </button>
          )}
        </div>
      )}

      {/* Add Announcement Dialog */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 shadow-3xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 select-none">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  📝 Publier un nouveau communiqué de l'Établissement
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-bold uppercase transition cursor-pointer shrink-0"
                >
                  Annuler
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Titre du Communiqué <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Report des évaluations harmonisées du 2e trimestre"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Catégorie <span className="text-red-500">*</span></label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-850"
                  >
                    <option value="General">Normal / Général</option>
                    <option value="Urgent">Urgent / Alerte</option>
                    <option value="Event">Événementiel</option>
                    <option value="Academic">Académique</option>
                    <option value="Sponsored">📢 Annonce Publicitaire Sponsorisée</option>
                  </select>
                </div>
              </div>

              {category === 'Sponsored' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-amber-50/70 border border-amber-200 rounded-xl p-4.5 space-y-3.5"
                >
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Configuration de la Campagne Publicitaire (Sponsorisé)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-amber-850 uppercase">Nom de l'Annonceur / Sponsor <span className="text-amber-600">*</span></label>
                      <input
                        type="text"
                        required={category === 'Sponsored'}
                        value={sponsorNameInput}
                        onChange={(e) => setSponsorNameInput(e.target.value)}
                        placeholder="Ex: Librairie PapetVogt"
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-lg focus:outline-amber-500 font-medium text-slate-850"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-amber-850 uppercase">Badge Publicitaire / Accroche</label>
                      <input
                        type="text"
                        value={sponsorBadgeInput}
                        onChange={(e) => setSponsorBadgeInput(e.target.value)}
                        placeholder="Ex: Promo -15% ou Offre Spéciale"
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-lg focus:outline-amber-500 font-medium text-slate-850"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-amber-850 uppercase">Lien de redirection de l'offre <span className="text-amber-600">*</span></label>
                      <input
                        type="url"
                        required={category === 'Sponsored'}
                        value={sponsorLinkInput}
                        onChange={(e) => setSponsorLinkInput(e.target.value)}
                        placeholder="Ex: https://example.com/promo"
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-lg focus:outline-amber-500 font-medium text-slate-850"
                      />
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-amber-700/85 leading-normal">
                    💡 Les annonces de type <strong>Sponsorisé</strong> s'affichent avec un design premium dans l'onglet des parents et élèves. Chaque clic sur le lien de l'offre ou la consultation génère des revenus publicitaires passifs comptabilisés dans le tableau de bord financier de l'établissement (Régie Pub).
                  </p>
                </motion.div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Signataire / Auteur <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Ex: Le Censeur des Études"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-850"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Corps du message <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Écrivez ici le message officiel détaillé à l'attention des parents d'élèves..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800 leading-normal"
                ></textarea>
              </div>

              {/* Pièces jointes : Images & Documents */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Section Image Illustration */}
                <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-indigo-500" />
                      {language === 'fr' ? 'Image / Illustration (Facultatif)' : 'Image / Illustration (Optional)'}
                    </h4>
                    <div className="flex bg-slate-200/60 p-0.5 rounded-lg text-[9px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setImageSourceType('upload');
                          handleRemoveImage();
                        }}
                        className={`px-1.5 py-0.5 rounded transition-all ${imageSourceType === 'upload' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-850'}`}
                      >
                        {language === 'fr' ? 'Fichier' : 'File'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImageSourceType('url');
                          handleRemoveImage();
                        }}
                        className={`px-1.5 py-0.5 rounded transition-all ${imageSourceType === 'url' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-850'}`}
                      >
                        {language === 'fr' ? 'Lien Web' : 'Web Link'}
                      </button>
                    </div>
                  </div>

                  {imageSourceType === 'upload' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg p-3 bg-white transition relative cursor-pointer">
                        <input
                          type="file"
                          ref={imageInputRef}
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <div className="text-center space-y-0.5 select-none pointer-events-none">
                          <FileUp className="h-4.5 w-4.5 text-slate-400 mx-auto" />
                          <p className="text-[10px] font-bold text-slate-700">
                            {imageFileName ? imageFileName : (language === 'fr' ? 'Glisser-déposer ou cliquer' : 'Drag & drop or click')}
                          </p>
                          <p className="text-[8px] text-slate-400">
                            {language === 'fr' ? 'Max: 10 Mo (téléversé sur Firebase Storage)' : 'Max: 10 MB (uploaded to Firebase Storage)'}
                          </p>
                        </div>
                      </div>
                      {imageFileName && (
                        <div className="flex items-center justify-between bg-indigo-50/50 border border-indigo-100 rounded-lg p-1.5 text-xs">
                          <span className="font-bold text-indigo-900 truncate flex items-center gap-1">
                            <ImageIcon className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                            {imageFileName}
                          </span>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="px-1.5 py-0.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-red-600 rounded text-[9px] font-bold transition cursor-pointer"
                          >
                            {language === 'fr' ? 'Supprimer' : 'Remove'}
                          </button>
                        </div>
                      )}
                      {imageFileError && (
                        <p className="text-[9px] text-red-600 font-bold">⚠️ {imageFileError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <input
                        type="url"
                        value={(imageUrlInput.startsWith('data:') || imageUrlInput.startsWith('blob:')) ? '' : imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full text-xs font-medium rounded-lg border border-slate-200 bg-white p-2 focus:border-indigo-500 focus:outline-none text-slate-800"
                      />
                      <p className="text-[8px] text-slate-400">
                        {language === 'fr' ? "Adresse URL directe d'une image publique" : 'Direct web link of a public image'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Section Document d'accompagnement (PDF) */}
                <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-rose-500" />
                      {language === 'fr' ? 'Document PDF Joint (Facultatif)' : 'Attached PDF Document (Optional)'}
                    </h4>
                    <div className="flex bg-slate-200/60 p-0.5 rounded-lg text-[9px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setPdfSourceType('upload');
                          handleRemovePdf();
                        }}
                        className={`px-1.5 py-0.5 rounded transition-all ${pdfSourceType === 'upload' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-850'}`}
                      >
                        {language === 'fr' ? 'Fichier' : 'File'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPdfSourceType('url');
                          handleRemovePdf();
                        }}
                        className={`px-1.5 py-0.5 rounded transition-all ${pdfSourceType === 'url' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-850'}`}
                      >
                        {language === 'fr' ? 'Lien Web' : 'Web Link'}
                      </button>
                    </div>
                  </div>

                  {pdfSourceType === 'upload' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg p-3 bg-white transition relative cursor-pointer">
                        <input
                          type="file"
                          ref={pdfInputRef}
                          accept="application/pdf"
                          onChange={handlePdfFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <div className="text-center space-y-0.5 select-none pointer-events-none">
                          <FileUp className="h-4.5 w-4.5 text-slate-400 mx-auto" />
                          <p className="text-[10px] font-bold text-slate-700">
                            {pdfFileName ? pdfFileName : (language === 'fr' ? 'Glisser-déposer ou cliquer' : 'Drag & drop or click')}
                          </p>
                          <p className="text-[8px] text-slate-400">
                            {language === 'fr' ? 'Max: 10 Mo (téléversé sur Firebase Storage)' : 'Max: 10 MB (uploaded to Firebase Storage)'}
                          </p>
                        </div>
                      </div>
                      {pdfFileName && (
                        <div className="flex items-center justify-between bg-rose-50/50 border border-rose-100 rounded-lg p-1.5 text-xs">
                          <span className="font-bold text-rose-950 truncate flex items-center gap-1">
                            <File className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                            {pdfFileName}
                          </span>
                          <button
                            type="button"
                            onClick={handleRemovePdf}
                            className="px-1.5 py-0.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-600 rounded text-[9px] font-bold transition cursor-pointer"
                          >
                            {language === 'fr' ? 'Supprimer' : 'Remove'}
                          </button>
                        </div>
                      )}
                      {pdfFileError && (
                        <p className="text-[9px] text-red-600 font-bold">⚠️ {pdfFileError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <input
                        type="url"
                        value={(pdfUrlInput.startsWith('data:') || pdfUrlInput.startsWith('blob:')) ? '' : pdfUrlInput}
                        onChange={(e) => setPdfUrlInput(e.target.value)}
                        placeholder="https://exemple.com/bulletin-officiel.pdf"
                        className="w-full text-xs font-medium rounded-lg border border-slate-200 bg-white p-2 focus:border-indigo-500 focus:outline-none text-slate-800"
                      />
                      <p className="text-[8px] text-slate-400">
                        {language === 'fr' ? "Adresse URL directe d'un PDF public" : 'Direct web link of a public PDF'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {isPedAuthorized && (
                <div className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl select-none">
                  <input
                    type="checkbox"
                    id="form-pin-announcement"
                    checked={isPinnedForm}
                    onChange={(e) => setIsPinnedForm(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="form-pin-announcement" className="text-xs font-bold text-indigo-950 cursor-pointer flex items-center gap-1.5">
                    <Pin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    {language === 'fr' 
                      ? 'Épingler ce communiqué en haut de la liste pour une visibilité maximale' 
                      : 'Pin this announcement to the top of the feed for maximum visibility'}
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-250 bg-white text-slate-800 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-slate-50 cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 cursor-pointer text-center shadow-xs disabled:opacity-75 disabled:cursor-not-allowed min-w-[120px]"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{language === 'fr' ? 'Envoi...' : 'Uploading...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" /> 
                      <span>{language === 'fr' ? 'Diffuser' : 'Publish'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedAnnouncements.map((ann, idx) => {
          const config = getCategoryTheme(ann.category);
          const Icon = config.icon;
          const isCustom = ann.id.startsWith('ann_') && Number(ann.id.split('_')[1]) > 100000;
          const isPinned = !!(ann.pinned || localPinnedIds.includes(ann.id));
          const isSpon = !!ann.isSponsored;
          
          // Compute dynamic clicks and impressions
          const currentClicks = adClicksMap[ann.id] !== undefined ? adClicksMap[ann.id] : (ann.adClicks || 0);
          const currentImpressions = isSpon ? ((ann.adImpressions || 0) + 1) : 0; // Simulate +1 impression on render

          const handleAdClick = (e: React.MouseEvent) => {
            if (isSpon) {
              setAdClicksMap(prev => ({
                ...prev,
                [ann.id]: currentClicks + 1
              }));
              // Save to localStorage or similar, or just show a nice notification
              console.log(`Ad Click recorded for ${ann.id}. New count: ${currentClicks + 1}`);
            }
          };

          return (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`p-5 rounded-2xl border ${
                isSpon 
                  ? 'border-amber-300 bg-gradient-to-br from-amber-50/45 to-yellow-50/20 shadow-sm hover:shadow-md' 
                  : config.bg
              } ${isPinned ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-50/10 shadow-xs' : ''} flex flex-col justify-between transition-all hover:shadow-xs relative group duration-300`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    isSpon 
                      ? 'bg-amber-100 text-amber-900 border border-amber-300/60 animate-pulse' 
                      : config.badge
                  }`}>
                    {isSpon ? (
                      <>
                        <Sparkles className="h-2.5 w-2.5 text-amber-600 animate-spin" />
                        <span>Sponsorisé • {ann.sponsorBadgeText || 'Annonce'}</span>
                      </>
                    ) : (
                      ann.category
                    )}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono text-gray-500 mr-1">{ann.date}</span>
                    
                    {/* Pin Toggle or Static Badge */}
                    {isPinned ? (
                      isPedAuthorized ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePin(ann.id, true)}
                          className="p-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-all border border-amber-300 cursor-pointer flex items-center gap-1 text-[10px] font-extrabold"
                          title={language === 'fr' ? 'Désépingler ce communiqué' : 'Unpin this announcement'}
                        >
                          <Pin className="h-3 w-3 fill-amber-600 text-amber-700" />
                          <span>{language === 'fr' ? 'Épinglé' : 'Pinned'}</span>
                        </button>
                      ) : (
                        <div className="p-1 bg-amber-100 text-amber-800 rounded-lg border border-amber-200 flex items-center gap-1 text-[10px] font-extrabold select-none">
                          <Pin className="h-3 w-3 fill-amber-600 text-amber-700" />
                          <span>{language === 'fr' ? 'Épinglé' : 'Pinned'}</span>
                        </div>
                      )
                    ) : (
                      isPedAuthorized && (
                        <button
                          type="button"
                          onClick={() => handleTogglePin(ann.id, false)}
                          className="p-1 text-gray-400 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition-all border border-transparent hover:border-amber-200 cursor-pointer flex items-center gap-1 text-[10px] font-extrabold"
                          title={language === 'fr' ? 'Épingler ce communiqué' : 'Pin this announcement'}
                        >
                          <Pin className="h-3 w-3 rotate-45" />
                        </button>
                      )
                    )}

                    {onDeleteAnnouncement && (
                      <button
                        type="button"
                        onClick={() => handleDelete(ann.id, ann.title)}
                        className={`text-red-650 hover:text-red-800 p-1 bg-red-100/10 hover:bg-red-150/30 rounded-lg transition-all border border-red-500/10 cursor-pointer ${
                          isPedAuthorized || isCustom ? 'opacity-100' : 'opacity-40 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100'
                        }`}
                        title="Supprimer ce communiqué officiel"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                
                <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-amber-600" />
                  {ann.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{ann.content}</p>

                {/* Attached Image display */}
                {ann.imageUrl && (
                  <div className="mt-3.5 overflow-hidden rounded-xl border border-slate-150/80 bg-slate-50 relative group/img">
                    <img
                      src={ann.imageUrl}
                      alt={ann.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-auto max-h-56 object-cover rounded-xl transition duration-300 group-hover/img:scale-[1.01]"
                    />
                  </div>
                )}

                {/* Sponsored Ads CTA link */}
                {isSpon && ann.sponsorLink && (
                  <div className="mt-4 bg-white/70 border border-amber-200 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-amber-850 uppercase tracking-wider">Offre Proposée par :</p>
                      <p className="text-xs font-extrabold text-slate-900">{ann.sponsorName || 'Partenaire'}</p>
                    </div>
                    
                    <a
                      href={ann.sponsorLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleAdClick}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-extrabold text-xs rounded-xl shadow-xs text-center transition active:scale-97 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>{language === 'fr' ? "Découvrir l'offre ↗" : "Visit Offer ↗"}</span>
                    </a>
                  </div>
                )}

                {/* Attached PDF document display */}
                {ann.pdfUrl && (
                  <div className="mt-3.5 space-y-2">
                    <div className="flex items-center justify-between p-2.5 bg-rose-50/55 border border-rose-100 rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-5 w-5 text-rose-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-rose-950 truncate">
                            {ann.pdfFileName || (language === 'fr' ? 'Document PDF Joint.pdf' : 'Attached PDF Document.pdf')}
                          </p>
                          <p className="text-[9px] text-rose-600 font-extrabold uppercase tracking-wider">
                            {language === 'fr' ? 'Fichier PDF' : 'PDF Document'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setActivePdfAnnId(activePdfAnnId === ann.id ? null : ann.id)}
                          className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          {activePdfAnnId === ann.id ? (
                            <>
                              <EyeOff className="h-3 w-3 text-rose-500" />
                              <span>{language === 'fr' ? 'Masquer' : 'Hide'}</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3 text-rose-500" />
                              <span>{language === 'fr' ? 'Consulter' : 'View'}</span>
                            </>
                          )}
                        </button>
                        <a
                          href={ann.pdfUrl}
                          download={ann.pdfFileName || 'document.pdf'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          {language === 'fr' ? 'Ouvrir' : 'Open'}
                        </a>
                      </div>
                    </div>

                    {/* Inline PDF viewer frame */}
                    {activePdfAnnId === ann.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border border-rose-100 rounded-xl bg-white p-1.5 shadow-3xs"
                      >
                        <iframe
                          src={ann.pdfUrl}
                          title={ann.pdfFileName || 'PDF Viewer'}
                          className="w-full h-80 rounded-lg border-0"
                        />
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="pt-3 mt-4 border-t border-black/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-[11px] font-medium text-gray-500 select-none">
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <span>Émis par : <strong className="text-gray-700">{ann.author}</strong></span>
                  
                  {isSpon && (
                    <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <span>📊 {currentClicks} Clics</span>
                      <span>•</span>
                      <span>{currentImpressions} Vues</span>
                      <span className="font-extrabold text-amber-900">({(currentClicks * 250).toLocaleString()} FCFA)</span>
                    </span>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => handleSpeakAnnouncement(ann.id, ann.title, ann.content)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[10px] cursor-pointer transition flex items-center justify-center gap-1 shadow-2xs border ${
                    speakingAnnId === ann.id
                      ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse'
                      : ann.category === 'Urgent'
                        ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                        : isSpon
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                  title={isEn ? "Listen to this announcement" : "Écouter ce communiqué"}
                >
                  {speakingAnnId === ann.id ? (
                    <>
                      <VolumeX className="h-3 w-3 shrink-0" />
                      <span>{isEn ? "Stop" : "Arrêter"}</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3 w-3 shrink-0" />
                      <span>
                        {ann.category === 'Urgent' 
                          ? (isEn ? "🔊 Listen Alert" : "🔊 Écouter l'Alerte") 
                          : isSpon
                            ? (isEn ? "Listen Ad" : "Écouter la Pub")
                            : (isEn ? "Listen" : "Écouter")}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Custom Confirmation Modal for Deleting Announcements */}
      {deleteAnnConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-50 text-red-600 mb-4 shadow-3xs">
                <Trash2 className="h-6.5 w-6.5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-950">
                {isEn ? "Confirm deletion" : "Confirmer la suppression"}
              </h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                {isEn 
                  ? "Are you sure you want to permanently delete this official announcement? This action is irreversible." 
                  : "Êtes-vous sûr de vouloir supprimer définitivement ce communiqué officiel ? Cette action est irréversible."}
              </p>
              
              {(() => {
                const ann = allAnnouncements.find(a => a.id === deleteAnnConfirmId);
                if (!ann) return null;
                return (
                  <div className="mt-4 p-3 bg-red-50/50 rounded-2xl border border-red-100 text-left space-y-1">
                    <div className="text-[10px] font-bold text-red-800 uppercase tracking-wide">Titre du communiqué :</div>
                    <div className="text-xs font-extrabold text-slate-800">{ann.title}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-2 mt-1 font-medium">{ann.content}</div>
                  </div>
                );
              })()}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteAnnConfirmId(null)}
                className="flex-1 px-4 py-2 text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer text-center"
              >
                {isEn ? "Cancel" : "Annuler"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteAnnConfirmId;
                  setDeleteAnnConfirmId(null);
                  if (onDeleteAnnouncement && id) {
                    await onDeleteAnnouncement(id);
                  }
                }}
                className="flex-1 px-4 py-2 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-xl transition shadow-xs active:scale-97 cursor-pointer text-center"
              >
                {isEn ? "Delete" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
