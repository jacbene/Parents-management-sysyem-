import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KeyRound, Mail, ArrowRight, CheckCircle2, AlertCircle, Loader2, X, RefreshCw, ShieldCheck, Lock } from 'lucide-react';
import { resetPassword } from '../firebase';

export interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onBackToLogin?: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  onBackToLogin
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail);
      setError(null);
      setSuccess(false);
      setSentEmail('');
      setLoading(false);
    }
  }, [isOpen, initialEmail]);

  const mapAuthErrorCode = (code: string): string => {
    switch (code) {
      case 'auth/invalid-email':
        return "L'adresse e-mail saisie est invalide.";
      case 'auth/user-not-found':
        return "Aucun compte n'est associé à cette adresse e-mail.";
      case 'auth/too-many-requests':
        return "Trop de demandes ont été effectuées. Veuillez patienter quelques minutes avant de réessayer.";
      case 'auth/network-request-failed':
        return "Erreur réseau. Vérifiez votre connexion Internet.";
      default:
        return "Impossible d'envoyer l'e-mail de réinitialisation. Veuillez réessayer.";
    }
  };

  const validateEmail = (emailStr: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(emailStr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Veuillez saisir votre adresse e-mail.");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError("Veuillez saisir une adresse e-mail valide (ex: utilisateur@exemple.com).");
      return;
    }

    setLoading(true);

    try {
      await resetPassword(trimmedEmail);
      setSentEmail(trimmedEmail);
      setSuccess(true);
    } catch (err: any) {
      console.error("Forgot Password Error:", err);
      const msg = err?.code ? mapAuthErrorCode(err.code) : (err?.message || "Une erreur est survenue lors de l'envoi.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!sentEmail || loading) return;
    setLoading(true);
    setError(null);
    try {
      await resetPassword(sentEmail);
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.code ? mapAuthErrorCode(err.code) : (err?.message || "Échec du renvoi.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-8 z-10 overflow-hidden"
        >
          {/* Top Decorative Graphic */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleClose}
            type="button"
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          {!success ? (
            /* Request Form */
            <div className="space-y-6">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-800/60 shadow-xs">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Mot de passe oublié ?
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Réinitialisation sécurisée par e-mail
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Saisissez l'adresse e-mail associée à votre compte. Nous vous enverrons immédiatement un lien de réinitialisation sécurisé.
              </p>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1">{error}</div>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                    Adresse e-mail
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="nom@exemple.com"
                      required
                      autoFocus
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Envoi du lien en cours...</span>
                      </>
                    ) : (
                      <>
                        <span>Envoyer le lien de réinitialisation</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {onBackToLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onBackToLogin();
                      }}
                      className="w-full py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer text-center"
                    >
                      ← Retour à la page de connexion
                    </button>
                  )}
                </div>
              </form>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Protection Firebase Authentication SSL</span>
              </div>
            </div>
          ) : (
            /* Confirmation / Success View */
            <div className="text-center space-y-6 py-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800/80 shadow-inner"
              >
                <CheckCircle2 className="w-8 h-8" />
              </motion.div>

              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  E-mail transmis avec succès !
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Vérifiez votre boîte de réception
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-left space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Un e-mail contenant les instructions pour définir un nouveau mot de passe a été envoyé à :
                </p>
                <div className="py-2 px-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 break-all flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{sentEmail}</span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-left text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Conseils de sécurité :</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300/90">
                  <li>Vérifiez le dossier <strong>Courriers indésirables (Spam)</strong> si vous ne le trouvez pas.</li>
                  <li>Le lien de réinitialisation expire pour votre sécurité.</li>
                </ul>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-3 px-4 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer shadow-md"
                >
                  Compris, fermer
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="w-full py-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Vous n'avez rien reçu ? Renvoyer l'e-mail</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;
