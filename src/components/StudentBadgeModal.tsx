import React, { useRef } from 'react';
import { Student } from '../types';
import { X, Printer, ShieldCheck, Download, QrCode, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudentBadgeModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  schoolName?: string;
}

export default function StudentBadgeModal({
  student,
  isOpen,
  onClose,
  schoolName = "COMPLEXE SCOLAIRE PASMA"
}: StudentBadgeModalProps) {
  const badgeRef = useRef<HTMLDivElement>(null);

  const handlePrintBadge = () => {
    // Elegant printing strategy for the badge alone
    const printContent = badgeRef.current?.innerHTML;
    const originalContent = document.body.innerHTML;

    if (printContent) {
      // Create a specific stylesheet for the printed badge
      const style = document.createElement('style');
      style.innerHTML = `
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            height: 100vh !important;
          }
          .no-print-badge {
            display: none !important;
          }
          .badge-print-container {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            transform: scale(1) !important;
          }
        }
      `;
      document.head.appendChild(style);
      
      window.print();
      
      // Clean up
      document.head.removeChild(style);
    }
  };

  const isImageAvatar = (avatar: string) => {
    return avatar && (avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/'));
  };

  if (!isOpen) return null;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=0f172a&data=${encodeURIComponent(student.id)}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-55 select-none text-gray-900 no-print-badge">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden w-full max-w-md max-h-[92vh] flex flex-col"
        >
          {/* Header Banner */}
          <div className="p-4 bg-indigo-650 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-indigo-200" />
              <div>
                <h3 className="text-sm font-black font-sans">Carte d'Identité Scolaire</h3>
                <p className="text-[10px] text-indigo-100 font-medium">Badge officiel certifié par PASMA</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Main Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col items-center justify-center space-y-6">
            
            {/* The Badge Container to print */}
            <div 
              ref={badgeRef}
              className="badge-print-container w-72 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col relative transition-transform duration-300 hover:scale-[1.01]"
              style={{ minHeight: '430px' }}
            >
              
              {/* Upper Diagonal Colors */}
              <div className="h-20 bg-gradient-to-r from-indigo-650 via-indigo-600 to-indigo-850 relative text-white px-3 py-2.5 flex flex-col items-center justify-between text-center select-none shrink-0">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
                <span className="text-[9.5px] font-black tracking-widest uppercase truncate w-full font-sans">{schoolName}</span>
                <span className="text-[7.5px] uppercase font-black text-indigo-250 tracking-wider">CARTE D'IDENTITÉ SCOLAIRE • {new Date().getFullYear()}-{new Date().getFullYear() + 1}</span>
              </div>

              {/* Photo Frame Container overlap */}
              <div className="flex flex-col items-center -mt-9 relative z-10 shrink-0">
                <div className="w-18 h-18 rounded-2xl bg-white p-1 shadow-md border border-slate-100 flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100/50 font-sans text-3xl">
                    {isImageAvatar(student.avatar) ? (
                      <img 
                        src={student.avatar} 
                        alt={student.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>{student.avatar || "🎓"}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Identity Details */}
              <div className="px-5 pt-3 pb-3 text-center flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-base font-black text-slate-900 tracking-tight capitalize leading-tight">{student.name}</h4>
                  <p className="text-xs text-indigo-600 font-extrabold uppercase tracking-wide mt-1">{student.grade} - {student.classRoom}</p>
                </div>

                {/* QR Code Segment */}
                <div className="my-3 mx-auto p-1.5 bg-slate-50 border border-slate-150 rounded-2xl w-fit flex flex-col items-center">
                  <img
                    src={qrCodeUrl}
                    alt="Badge QR"
                    className="w-24 h-24 object-contain rounded-md"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[8.5px] font-mono text-slate-400 mt-1 uppercase tracking-wider font-semibold">REF: {student.id.slice(0, 12)}</span>
                </div>

                {/* Footer Security / Barcode mockups */}
                <div className="border-t border-slate-150 pt-2 flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-[6.5px] font-bold text-slate-400 block uppercase font-sans">Statut Vérifié</span>
                    <span className="text-[7.5px] font-semibold text-emerald-600 flex items-center gap-0.5"><ShieldCheck className="h-3 w-3 inline shrink-0 text-emerald-500" /> ÉLÈVE ACTIF</span>
                  </div>
                  
                  {/* Mock Barcode lines decoration */}
                  <div className="h-5 flex items-end gap-[1.5px] opacity-75">
                    {[1, 3, 2, 4, 1, 3, 1, 2, 4, 2, 1, 3, 1].map((w, idx) => (
                      <div key={idx} className="bg-slate-900 h-full" style={{ width: `${w * 0.75}px` }} />
                    ))}
                  </div>
                </div>

              </div>

            </div>

            {/* Direct Tip */}
            <p className="text-[11px] font-medium text-slate-400 text-center max-w-xs leading-normal">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 inline mr-1 shrink-0" />
              Ce badge contient un identifiant cryptographique unique. Présentez-le sur smartphone ou imprimé pour scanner l'assiduité scolaire.
            </p>

          </div>

          {/* Modal Action Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex justify-between items-center shrink-0">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold text-xs text-slate-600 rounded-xl transition cursor-pointer"
            >
              Retour
            </button>
            <button
              onClick={handlePrintBadge}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5 active:scale-97 border border-indigo-500/50"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimer le Badge</span>
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
