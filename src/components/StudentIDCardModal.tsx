import React, { useRef } from 'react';
import { X, Printer, QrCode, ShieldCheck, Award, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, ApeeSettings } from '../types';

interface StudentIDCardModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  settings?: ApeeSettings;
}

export default function StudentIDCardModal({ student, isOpen, onClose, settings }: StudentIDCardModalProps) {
  const cardPrintRef = useRef<HTMLDivElement>(null);

  const handlePrintCard = () => {
    const printContent = cardPrintRef.current?.innerHTML;
    if (!printContent) return;

    const originalContent = document.body.innerHTML;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Carte ID Scolaire - ${student.name}</title>
            <style>
              body {
                font-family: 'Inter', sans-serif;
                margin: 0;
                padding: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: #fff;
              }
              .print-container {
                display: block !important;
              }
              @page {
                size: 85mm 54mm; /* Standard ID-1 Credit Card dimensions */
                margin: 0;
              }
              /* Embedded styles for beautiful look matching tailwind colors */
              .card {
                width: 340px;
                height: 220px;
                background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%);
                color: #ffffff;
                border-radius: 12px;
                padding: 16px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                position: relative;
                box-shadow: 0 4px 10px rgba(0,0,0,0.15);
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .header {
                display: flex;
                align-items: center;
                gap: 8px;
                border-b: 1px dashed rgba(255,255,255,0.2);
                padding-bottom: 6px;
              }
              .school-title {
                font-size: 10px;
                font-weight: 950;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                margin: 0;
                color: #e0e7ff;
              }
              .school-subtitle {
                font-size: 8px;
                font-weight: 500;
                color: #a5b4fc;
                margin: 0;
              }
              .content {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-top: 8px;
              }
              .photo-frame {
                width: 64px;
                height: 64px;
                border-radius: 8px;
                border: 2px solid rgba(255,255,255,0.3);
                background-color: rgba(255,255,255,0.1);
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-center: center;
              }
              .photo-frame img {
                width: 100%;
                height: 100%;
                object-fit: cover;
              }
              .photo-frame .emoji {
                font-size: 32px;
                line-height: 64px;
                text-align: center;
                display: block;
                width: 100%;
              }
              .details {
                flex: 1;
                min-width: 0;
                text-align: left;
              }
              .student-name {
                font-size: 14px;
                font-weight: 800;
                margin: 0 0 4px 0;
                color: #ffffff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .badge-meta {
                display: inline-block;
                background-color: rgba(255,255,255,0.15);
                border: 1px solid rgba(255,255,255,0.1);
                color: #fff;
                font-size: 8px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 100px;
                text-transform: uppercase;
                margin-bottom: 4px;
              }
              .detail-row {
                font-size: 8.5px;
                color: #c7d2fe;
                margin: 2px 0;
              }
              .detail-row strong {
                color: #ffffff;
              }
              .footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-top: 6px;
                border-t: 1px solid rgba(255,255,255,0.15);
                padding-top: 6px;
              }
              .qr-container {
                background-color: #ffffff;
                padding: 3px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 42px;
                height: 42px;
              }
              .qr-container img {
                width: 100%;
                height: 100%;
              }
              .card-id-num {
                font-family: monospace;
                font-size: 7.5px;
                color: #818cf8;
              }
              .sec-indicator {
                font-size: 6px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #a5b4fc;
              }
            </style>
          </head>
          <body>
            <div class="card">
              ${printContent}
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const isImageAvatar = (avatar: string) => {
    return avatar && (avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/'));
  };

  // Generate a valid high definition public API QR Code endpoint
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(student.id)}`;

  const establishmentName = settings?.associationName || "Complexe Scolaire Intégré";
  const sectionLabel = settings?.schoolYear ? `Année Scolaire ${settings.schoolYear}` : "Système d'Émargement Officiel";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl border border-gray-250 shadow-2xl overflow-hidden w-full max-w-md flex flex-col"
        >
          {/* Header */}
          <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
            <h3 className="text-sm font-black flex items-center gap-1.5 font-sans">
              <CreditCard className="h-4.5 w-4.5" />
              <span>Carte d'Identité Scolaire (QR)</span>
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6 flex flex-col items-center justify-center space-y-6">
            
            {/* Realtime Live preview of ID Card */}
            <div className="p-1 bg-slate-100 rounded-3xl border border-slate-205 shadow-inner">
              <div 
                id="student-id-printable-card"
                className="w-[340px] h-[220px] rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-950 p-4 text-white flex flex-col justify-between relative shadow-lg select-none"
              >
                {/* Embedded HTML block rendered & matched for printing */}
                <div ref={cardPrintRef} className="h-full flex flex-col justify-between">
                  
                  {/* Card Header */}
                  <div className="header flex items-center gap-2 border-b border-dashed border-white/20 pb-1.5">
                    <div className="p-1 bg-white/15 rounded-lg border border-white/10 shrink-0">
                      <Award className="h-3.5 w-3.5 text-indigo-200" />
                    </div>
                    <div className="text-left">
                      <h4 className="school-title text-[9.5px] font-black uppercase tracking-wider text-indigo-50 leading-none m-0">
                        {establishmentName}
                      </h4>
                      <p className="school-subtitle text-[7.5px] font-medium text-indigo-200/90 leading-none m-0 mt-0.5">
                        {sectionLabel}
                      </p>
                    </div>
                  </div>

                  {/* Card Content body */}
                  <div className="content flex items-center gap-3 mt-2 flex-1">
                    <div className="photo-frame w-16 h-16 rounded-lg border border-white/20 bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {isImageAvatar(student.avatar) ? (
                        <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="emoji text-3xl leading-none block">{student.avatar}</span>
                      )}
                    </div>

                    <div className="details flex-1 min-w-0 text-left">
                      <span className="badge-meta inline-block bg-white/15 border border-white/10 text-white text-[7.5px] px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide mb-1 leading-none">
                        ÉLÈVE TITULAIRE
                      </span>
                      <h4 className="student-name text-[13px] font-black text-white m-0 truncate leading-tight">
                        {student.name}
                      </h4>
                      <p className="detail-row text-[8px] text-indigo-200 m-0 mt-1">
                        Classe: <strong className="text-white font-bold">{student.grade}</strong>
                      </p>
                      <p className="detail-row text-[8px] text-indigo-200 m-0">
                        Salle: <strong className="text-white font-bold">{student.classRoom}</strong>
                      </p>
                      <p className="detail-row text-[8px] text-indigo-200 m-0 truncate">
                        Enseignant: <strong className="text-white font-bold">{student.teacherName || 'Principal'}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="footer flex items-center justify-between border-t border-white/10 pt-2 shrink-0">
                    <div className="text-left leading-none">
                      <span className="sec-indicator text-[6.5px] font-bold text-indigo-300 uppercase tracking-widest block leading-none mb-0.5">
                        BADGE OFFICIEL D'ASSIDUITÉ
                      </span>
                      <span className="card-id-num font-mono text-[7px] text-indigo-400">
                        {student.id}
                      </span>
                    </div>

                    <div className="qr-container bg-white p-0.5 rounded-md flex items-center justify-center w-10 h-10 shrink-0">
                      <img src={qrUrl} alt="Student QR Code ID" className="w-full h-full" referrerPolicy="no-referrer" />
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Instruction Banner */}
            <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-start gap-2.5 text-left text-xs text-indigo-950">
              <ShieldCheck className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Comment utiliser cette carte ?</p>
                <p className="text-indigo-900 mt-0.5 text-[11px] leading-relaxed">
                  Imprimez ce badge pour l'élève. Le professeur principal ou le surveillant pourra scanner le QR code directement depuis son smartphone pour confirmer l'émargement en classe.
                </p>
              </div>
            </div>

            {/* Form actions */}
            <div className="w-full flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition font-bold text-xs text-slate-705 cursor-pointer text-center"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handlePrintCard}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white transition font-black text-xs cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm active:scale-97"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimer la Carte</span>
              </button>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
