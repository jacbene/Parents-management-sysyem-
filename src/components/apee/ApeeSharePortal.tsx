import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, ExternalLink, ShieldCheck, QrCode, MessageSquare, Mail, AlertCircle, MessageCircle, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../utils/TranslationContext';

interface ApeeSharePortalProps {
  associationName?: string;
  portalUserRole?: string;
}

export default function ApeeSharePortal({ associationName, portalUserRole }: ApeeSharePortalProps) {
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [shareTab, setShareTab] = useState<'link' | 'message' | 'qrcode'>('link');
  const [customRoleParam, setCustomRoleParam] = useState<'all' | 'parent' | 'manager'>('all');
  
  // Clean, canonical sharing URL
  const [shareUrl, setShareUrl] = useState('');

  // Editable personalized invitation message
  const [customMessage, setCustomMessage] = useState('');
  const [isEdited, setIsEdited] = useState(false);

  useEffect(() => {
    // Generate clean canonical URL for sharing
    let origin = window.location.origin;
    if (!origin || origin === 'null' || origin.includes('localhost:3000')) {
      // Safe fallback / deployment canonical domain
      origin = window.location.href.split('?')[0].split('#')[0];
    }
    
    let finalUrl = origin;
    if (customRoleParam === 'parent') {
      finalUrl += '?role=parent';
    } else if (customRoleParam === 'manager') {
      finalUrl += '?role=manager';
    }
    setShareUrl(finalUrl);
  }, [customRoleParam]);

  const getDefaultMessage = () => {
    const isEn = language === 'en';
    const school = associationName || "notre établissement";
    if (isEn) {
      if (customRoleParam === 'parent') {
        return `Hello Dear Parent,\n\nHere is your official secure link to access the Parent Space on the APEE Portal for ${school}:\n${shareUrl}\n\nYou can easily check your child's grades, homework, school fees, and official announcements online.\n\nWelcome to our school community!`;
      }
      return `Hello,\n\nHere is the secure access link to the APEE management & school portal for ${school}:\n${shareUrl}\n\nPlease log in securely.`;
    } else {
      if (customRoleParam === 'parent') {
        return `Bonjour Cher Parent,\n\nVoici votre lien d'accès officiel et sécurisé à l'Espace Parent du Portail APEE de ${school} :\n${shareUrl}\n\nVous pourrez y consulter les résultats scolaires de vos enfants, le suivi des cotisations, les devoirs et les annonces officielles de l'école.\n\nSoyez les bienvenus !`;
      }
      return `Bonjour,\n\nVoici le lien d'accès sécurisé du portail APEE de ${school} :\n${shareUrl}\n\nL'accès est protégé conformément aux normes de sécurité de l'établissement.`;
    }
  };

  // Sync default message when parameters change unless modified manually by user
  useEffect(() => {
    if (!isEdited) {
      setCustomMessage(getDefaultMessage());
    }
  }, [shareUrl, customRoleParam, language, associationName, isEdited]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(customMessage || getDefaultMessage());
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    } catch (err) {
      console.error('Failed to copy message', err);
    }
  };

  // QR Code URL via free secure qr code server
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}&color=312e81&bgcolor=ffffff`;

  const isEn = language === 'en';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs text-left" id="apee-share-portal">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 leading-none">
          <Share2 className="h-3.5 w-3.5 text-indigo-650" />
          {isEn ? "Share Application" : "Partager l'application"}
        </h4>
        <div className="flex items-center gap-1 text-[8.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
          <ShieldCheck className="h-3 w-3 shrink-0" />
          <span>{isEn ? "Secure 256-bit" : "Sécurisé SSL"}</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 leading-normal">
        {isEn 
          ? "Invite other members, parents, or supervisors. They will land on the safe authenticated login portal."
          : "Invitez d'autres membres, parents ou superviseurs académiques. L'accès requiert une authentification sécurisée."}
      </p>

      {/* Tabs selectors inside the widget */}
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg text-[9.5px] font-bold">
        <button
          type="button"
          onClick={() => setShareTab('link')}
          className={`py-1 rounded-md transition text-center cursor-pointer ${
            shareTab === 'link' ? 'bg-white text-indigo-950 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {isEn ? "Link" : "Lien"}
        </button>
        <button
          type="button"
          onClick={() => setShareTab('message')}
          className={`py-1 rounded-md transition text-center cursor-pointer ${
            shareTab === 'message' ? 'bg-white text-indigo-950 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {isEn ? "Invite Msg" : "Invitation"}
        </button>
        <button
          type="button"
          onClick={() => setShareTab('qrcode')}
          className={`py-1 rounded-md transition text-center cursor-pointer ${
            shareTab === 'qrcode' ? 'bg-white text-indigo-950 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          QR Code
        </button>
      </div>

      {/* Parameter choice to customize target role */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[8.5px] font-bold text-slate-400 uppercase shrink-0">Cible :</span>
        <div className="flex gap-1.5 text-[8.5px] font-extrabold">
          <button
            type="button"
            onClick={() => setCustomRoleParam('all')}
            className={`px-1.5 py-0.5 rounded transition border cursor-pointer ${
              customRoleParam === 'all' 
                ? 'bg-slate-900 text-white border-slate-900' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isEn ? "General" : "Général"}
          </button>
          <button
            type="button"
            onClick={() => setCustomRoleParam('parent')}
            className={`px-1.5 py-0.5 rounded transition border cursor-pointer ${
              customRoleParam === 'parent' 
                ? 'bg-indigo-600 text-white border-indigo-600' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isEn ? "Parents" : "Espace Parents"}
          </button>
          <button
            type="button"
            onClick={() => setCustomRoleParam('manager')}
            className={`px-1.5 py-0.5 rounded transition border cursor-pointer ${
              customRoleParam === 'manager' 
                ? 'bg-amber-600 text-white border-amber-600' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isEn ? "Managers" : "Gestionnaires"}
          </button>
        </div>
      </div>

      {/* Editable Text Input / Textarea for Invitation Message */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between text-[9px]">
          <label className="font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
            <MessageSquare className="h-3 w-3 text-indigo-600" />
            {isEn ? "Personalized Invitation Message:" : "Message d'invitation personnalisé :"}
          </label>
          {isEdited && (
            <button
              type="button"
              onClick={() => {
                setIsEdited(false);
                setCustomMessage(getDefaultMessage());
              }}
              className="text-[8.5px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer hover:underline"
              title={isEn ? "Reset to standard invitation" : "Réinitialiser au message standard"}
            >
              <RotateCcw className="h-2.5 w-2.5" />
              {isEn ? "Reset" : "Réinitialiser"}
            </button>
          )}
        </div>
        <textarea
          rows={3}
          value={customMessage}
          onChange={(e) => {
            setCustomMessage(e.target.value);
            setIsEdited(true);
          }}
          placeholder={isEn ? "Type your custom invitation message..." : "Personnalisez votre message d'invitation..."}
          className="w-full p-2 border border-slate-200 rounded-xl text-[9.5px] font-sans text-slate-800 bg-slate-50/70 focus:bg-white focus:outline-indigo-500 leading-relaxed resize-y transition"
        />
      </div>

      {/* Live Preview of Generated WhatsApp Message (Readonly) */}
      <div className="space-y-1 pt-0.5">
        <div className="flex items-center justify-between text-[9px]">
          <span className="font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
            <MessageCircle className="h-3 w-3 text-emerald-600" />
            {isEn ? "Live WhatsApp Preview (Read-Only):" : "Aperçu WhatsApp en direct (lecture seule) :"}
          </span>
          <span className="text-[8px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
            WhatsApp Web / Mobile
          </span>
        </div>
        <textarea
          readOnly
          rows={3}
          value={customMessage || getDefaultMessage()}
          className="w-full p-2 border border-emerald-200 bg-emerald-50/60 rounded-xl text-[9.5px] font-sans text-slate-800 leading-relaxed cursor-default select-all focus:outline-none resize-none"
        />
      </div>

      {/* Prominent WhatsApp Share Button with Pre-filled Invitation & Portal Link */}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(customMessage || getDefaultMessage())}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs no-underline"
      >
        <MessageCircle className="h-4 w-4 shrink-0 text-white" />
        <span>{isEn ? "Share via WhatsApp" : "Partager sur WhatsApp"}</span>
        <ExternalLink className="h-3 w-3 opacity-80 shrink-0" />
      </a>

      {/* Tab 1: Direct link copying */}
      {shareTab === 'link' && (
        <div className="space-y-2 pt-1 transition-all">
          <div className="flex gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 items-center">
            <span className="text-[9px] font-mono text-indigo-950 select-all truncate flex-1 pl-1">
              {shareUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className={`p-1.5 rounded-md cursor-pointer transition ${
                copied ? 'bg-emerald-100 text-emerald-800' : 'bg-white hover:bg-slate-100 border border-slate-250 text-slate-600'
              }`}
              title={isEn ? "Copy URL" : "Copier le lien"}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          
          <div className="flex items-start gap-1 p-1.5 bg-indigo-50/50 rounded-lg text-[9px] text-indigo-900 font-medium">
            <AlertCircle className="h-3 w-3 text-indigo-500 shrink-0 mt-0.5" />
            <span>
              {isEn 
                ? "This link routes to the default homepage. Safe for parent WhatsApp and email circles." 
                : "Ce lien redirige vers l'accueil d'origine. Idéal pour partager dans les groupes WhatsApp de parents d'élèves."}
            </span>
          </div>
        </div>
      )}

      {/* Tab 2: Custom Text message invite */}
      {shareTab === 'message' && (
        <div className="space-y-2 pt-1 transition-all">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 max-h-28 overflow-y-auto font-sans text-[9px] text-slate-750 leading-relaxed select-all">
            {customMessage}
          </div>
          
          <button
            type="button"
            onClick={handleCopyMessage}
            className={`w-full py-1.5 rounded-lg text-[9.5px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
              copiedMsg 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
            }`}
          >
            {copiedMsg ? (
              <>
                <Check className="h-3.5 w-3.5" />
                {isEn ? "Invitation copied!" : "Invitation copiée !"}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                {isEn ? "Copy preformatted message" : "Copier le message d'invitation"}
              </>
            )}
          </button>
        </div>
      )}

      {/* Tab 3: Scan on other devices QR Code */}
      {shareTab === 'qrcode' && (
        <div className="flex flex-col items-center justify-center p-2 bg-slate-50 border border-slate-180 rounded-xl space-y-2 text-center transition-all">
          <div className="bg-white p-2 rounded-lg shadow-3xs border border-slate-100">
            <img 
              src={qrCodeUrl} 
              alt="QR Code Portal" 
              className="w-28 h-28 shrink-0 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-[8px] font-sans text-slate-400 font-semibold uppercase tracking-wider">
            {isEn ? "Scan to open on smartphones" : "Scannez pour ouvrir sur mobile"}
          </p>
        </div>
      )}

      {/* Visual SSL certificate note */}
      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[8px] text-slate-400 font-bold">
        <span>HTTPS Security Protocol</span>
        <span className="font-mono text-[7px] text-indigo-400">APEE PORTAL v1.4.0</span>
      </div>
    </div>
  );
}

