import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Check, ChevronDown, Sparkles } from 'lucide-react';
import { useLanguage, SUPPORTED_LANGUAGES, LanguageType } from '../utils/TranslationContext';

interface LanguageSelectorProps {
  className?: string;
  variant?: 'header' | 'dropdown' | 'compact' | 'full';
}

export default function LanguageSelector({ className = '', variant = 'header' }: LanguageSelectorProps) {
  const { language, setLanguage, isAutoDetected } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs select-none active:scale-97 ${
          isOpen
            ? 'bg-indigo-50 dark:bg-slate-800 border-indigo-400 dark:border-indigo-500 text-indigo-700 dark:text-amber-400 ring-2 ring-indigo-500/20'
            : 'bg-white dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
        title={isAutoDetected ? `Langue active: ${currentLangObj.nativeName} (Détectée automatiquement)` : `Changer de langue (Actuelle: ${currentLangObj.nativeName})`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Globe className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        
        <span className="text-sm shrink-0 leading-none">{currentLangObj.flag}</span>
        
        <span className="font-black text-xs uppercase tracking-wider">
          {currentLangObj.code}
        </span>

        {isAutoDetected && (
          <span className="hidden sm:inline-flex items-center px-1 py-0.2 text-[8.5px] font-extrabold uppercase bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800">
            Auto
          </span>
        )}

        <ChevronDown className={`h-3 w-3 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden p-1.5 space-y-1"
          >
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Globe className="h-3 w-3 text-indigo-500" /> Sélecteur de langue
              </span>
              {isAutoDetected && (
                <span className="text-[9.5px] font-bold text-indigo-600 dark:text-amber-400 flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5" /> Détecté
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = language === lang.code;

                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs font-black'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{lang.flag}</span>
                      <div className="text-left">
                        <div className="leading-tight font-extrabold">{lang.nativeName}</div>
                        <div className={`text-[10px] font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {lang.label} ({lang.code.toUpperCase()})
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-white shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-1.5 border-t border-slate-150 dark:border-slate-800/80 px-2 pb-1 text-[10px] text-slate-400 dark:text-slate-500 text-center font-medium">
              Système multilingue Pasma-sys
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
