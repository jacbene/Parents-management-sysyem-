import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RefreshCw, AlertCircle, Volume2, VolumeX, Zap, User, Scan, Clock, CheckCircle, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsQR from 'jsqr';
import { Student, Attendance, AttendanceStatus } from '../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  allStudents: Student[];
  onAddAttendance: (log: Attendance) => Promise<boolean>;
}

export default function QRScannerModal({ isOpen, onClose, allStudents, onAddAttendance }: QRScannerModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [scanMode, setScanMode] = useState<'express' | 'manual'>('express');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [simulatedStudentId, setSimulatedStudentId] = useState<string>('');
  
  // Scanning state
  const [scanningActive, setScanningActive] = useState(true);
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const [alreadyLogged, setAlreadyLogged] = useState<boolean>(false);
  const [successLogs, setSuccessLogs] = useState<Array<{ studentName: string; status: AttendanceStatus; time: string; id: string }>>([]);
  
  // Manual submission state
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('Present');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Refs for tracking video stream and drawing to processing canvas
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

  // Sound Synthesizer chimes
  const playSuccessChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playBeep = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      playBeep(880, now, 0.08); // A5 (Gently high)
      playBeep(1320, now + 0.07, 0.14); // E6 (Joyful resolution)
    } catch (err) {
      console.warn("Chime failed", err);
    }
  };

  const playBuzzerChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (err) {
      console.warn("Buzzer failed", err);
    }
  };

  // Start & Stop Camera management
  useEffect(() => {
    if (isOpen) {
      startCamera();
      setScanningActive(true);
      setScannedStudent(null);
      setAlreadyLogged(false);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setIsActivating(true);
    setCameraError(null);
    stopCamera();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Require direct call & catch iOS Autoplay blocking
        videoRef.current.play().catch(e => console.warn("Autoplay failed:", e));
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      let desc = "Impossible d'accéder à la caméra.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        desc = "L'accès à la caméra a été refusé. Veuillez accorder la permission dans les paramètres ou l'URL de l'application.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        desc = "Aucun appareil photo ou webcam n'a été détecté.";
      }
      setCameraError(desc);
    } finally {
      setIsActivating(false);
    }
  };

  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
  };

  // Continuous loop checking frames for QR Code with jsQR
  useEffect(() => {
    if (!stream || !scanningActive || !isOpen) return;

    const scanFrame = () => {
      if (!videoRef.current || !canvasRef.current || !scanningActive) {
        requestRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });

      // Only scan if video is fully loaded
      if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        canvas.width = width;
        canvas.height = height;

        context.drawImage(video, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);

        // Perform qr code decoding
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleQRCodeDetected(code.data);
          return; // Terminate recursion on detection to avoid double scans
        }
      }
      requestRef.current = requestAnimationFrame(scanFrame);
    };

    requestRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [stream, scanningActive, isOpen, scanMode]);

  // Main callback to route scanned raw student ID
  const handleQRCodeDetected = async (scannedId: string) => {
    // 1. Debounce immediately by stopping scanner loop
    setScanningActive(false);

    // Filter, clean, or find matching student
    const cleanedId = scannedId.trim();
    const student = allStudents.find(s => s.id === cleanedId || (s.name || '').toLowerCase() === (cleanedId || '').toLowerCase());
    
    if (!student) {
      playBuzzerChime();
      alert(`⚠️ Badge ID Scolaire inconnu : "${cleanedId}". Cet élève n'existe pas ou n'appartient pas à votre espace parent.`);
      // Re-enable scanning after alert closes
      setTimeout(() => {
        setScanningActive(true);
      }, 1000);
      return;
    }

    // Set student details
    setScannedStudent(student);

    // Check if locked/validated
    if (student.attendanceValidated) {
      playBuzzerChime();
      alert(`🔒 Le registre d'assiduité de ${student.name} est validé et scellé par la direction. Émargement impossible.`);
      setScannedStudent(null);
      setTimeout(() => {
        setScanningActive(true);
      }, 1000);
      return;
    }

    // Process scanning depending on active modality
    if (scanMode === 'express') {
      // Create and save attendance instantly
      const todayStr = new Date().toISOString().split('T')[0];
      const newLog: Attendance = {
        id: 'att_' + Date.now(),
        studentId: student.id,
        parentId: student.parentId,
        date: todayStr,
        status: 'Present',
        remarks: 'Émargé via scan de carte ID scolaire'
      };

      try {
        const success = await onAddAttendance(newLog);
        if (success) {
          playSuccessChime();
          // Keep a temporary local log of session's successes
          const newSuccessLog = {
            id: newLog.id,
            studentName: student.name,
            status: 'Present' as AttendanceStatus,
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          };
          setSuccessLogs(prev => [newSuccessLog, ...prev]);
        } else {
          playBuzzerChime();
        }
      } catch (err) {
        playBuzzerChime();
        console.error("Scan attendance insert err:", err);
      }

      // Automatically reset scanning view after a minor visual celebration delay
      setTimeout(() => {
        setScannedStudent(null);
        setScanningActive(true);
      }, 1500);

    } else {
      // Manual confirmation mode: Just pause scanner, pop the details and let user customize
      playSuccessChime();
      setSelectedStatus('Present');
      setRemarks('Présence enregistrée par émargement QR-ID');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedStudent) return;

    setSubmitting(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const newLog: Attendance = {
      id: 'att_' + Date.now(),
      studentId: scannedStudent.id,
      parentId: scannedStudent.parentId,
      date: todayStr,
      status: selectedStatus,
      remarks: remarks.trim() || undefined
    };

    try {
      const success = await onAddAttendance(newLog);
      if (success) {
        // Keep in success history log
        const newSuccessLog = {
          id: newLog.id,
          studentName: scannedStudent.name,
          status: selectedStatus,
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        setSuccessLogs(prev => [newSuccessLog, ...prev]);
        
        // Reset states to continue scanning
        setScannedStudent(null);
        setScanningActive(true);
      } else {
        playBuzzerChime();
      }
    } catch (err) {
      playBuzzerChime();
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelScanned = () => {
    setScannedStudent(null);
    setScanningActive(true);
  };

  const isImageAvatar = (avatar: string) => {
    return avatar && (avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/'));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-900 text-white rounded-3xl border border-slate-750 shadow-2xl overflow-hidden w-full max-w-4xl max-h-[92vh] flex flex-col"
        >
          {/* Header Banner */}
          <div className="p-5 bg-slate-850 border-b border-slate-750 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600/30 rounded-xl border border-indigo-550/30">
                <Scan className="h-5 w-5 text-indigo-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black font-sans flex items-center gap-2">
                  Scanner de Badges Scolaires (QR Code)
                </h3>
                <p className="text-xs text-slate-400">
                  Présentez une carte d'étudiant devant la caméra pour marquer instantanément l'appel.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl border transition ${
                  soundEnabled 
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/20' 
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}
                title={soundEnabled ? "Couper le bip sonore" : "Activer le bip sonore"}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-xl transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Grid Layout of Scanner Area */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
            
            {/* Left Area: Camera & Viewfinder Feed (7 columns) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-750 shadow-inner flex flex-col items-center justify-center">
                
                {/* Simulated Canvas for Frame Interception in Background */}
                <canvas ref={canvasRef} className="hidden" />

                {cameraError ? (
                  <div className="p-6 text-center text-red-400 space-y-3">
                    <AlertCircle className="h-10 w-10 mx-auto" />
                    <h4 className="font-bold text-sm">Problème de caméra</h4>
                    <p className="text-xs text-slate-400 max-w-sm">{cameraError}</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Réessayer
                    </button>
                  </div>
                ) : isActivating ? (
                  <div className="text-center space-y-3 p-6">
                    <span className="h-8 w-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block" />
                    <p className="text-xs text-slate-400">Initialisation de l'optique de la caméra...</p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover transform scale-x-1"
                    />

                    {/* HUD viewFinder frames and grid target markers */}
                    <div className="absolute inset-0 border-[3px] border-transparent pointer-events-none flex items-center justify-center">
                      
                      {scanningActive && (
                        <div className="w-56 h-56 border-2 border-dashed border-indigo-400/60 rounded-3xl relative flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.2)]">
                          {/* Top-left corner */}
                          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
                          {/* Top-right corner */}
                          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
                          {/* Bottom-left corner */}
                          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
                          {/* Bottom-right corner */}
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />
                          
                          {/* Laser Scanning line */}
                          <div className="w-full h-0.5 bg-indigo-500 absolute animate-bounce" />
                          
                          <div className="text-[10px] text-indigo-300 font-bold tracking-widest uppercase bg-slate-900/80 px-2 py-0.5 rounded-md absolute -bottom-8 shadow-sm">
                            CIBLER LE QR CODE
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Instant validation/feedback celebrations overlay overlay in express mode */}
                <AnimatePresence>
                  {scannedStudent && scanMode === 'express' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-center p-6 space-y-4"
                    >
                      <div className="w-20 h-20 bg-indigo-600/25 border-2 border-indigo-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.4)] relative">
                        {isImageAvatar(scannedStudent.avatar) ? (
                          <img src={scannedStudent.avatar} alt="Student" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <span className="text-4xl">{scannedStudent.avatar}</span>
                        )}
                        <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 border border-slate-900 text-white rounded-full">
                          <Check className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1 justify-center">
                          <Flame className="h-3.5 w-3.5" /> ÉMARGEMENT EXPRESS ENREGISTRÉ !
                        </span>
                        <h4 className="text-xl font-black font-sans text-white">{scannedStudent.name}</h4>
                        <p className="text-xs text-slate-400 font-medium">{scannedStudent.classRoom} • {scannedStudent.grade}</p>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10.5px] uppercase font-black border border-emerald-500/20 rounded-full tracking-wide">
                        <CheckCircle className="h-4 w-4" /> STATUT : PRÉSENT EN CLASSE
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mode Control Selectors */}
              <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-2.5">
                  Mode de Numérisation :
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setScanMode('express');
                      setScannedStudent(null);
                      setScanningActive(true);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex gap-3 items-start ${
                      scanMode === 'express'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <Zap className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <h4 className="text-xs font-black">Mode Express (Par défaut)</h4>
                      <p className="text-[10.5px] text-slate-300 mt-0.5 leading-relaxed">
                        Le scan d'un badge émerge <strong>instantanément</strong> l'élève comme Présent (idéal au portail de l'école).
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScanMode('manual');
                      setScannedStudent(null);
                      setScanningActive(true);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex gap-3 items-start ${
                      scanMode === 'manual'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <User className="h-5 w-5 shrink-0 mt-0.5 text-indigo-400" />
                    <div>
                      <h4 className="text-xs font-black">Mode Manuel / Justificatifs</h4>
                      <p className="text-[10.5px] text-slate-300 mt-0.5 leading-relaxed">
                        Met le scanner en pause, affiche le dossier de l'élève et vous permet de changer le statut ou justifier l'absence.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Simulator Section */}
              <div className="bg-slate-850 border border-slate-750/60 p-4 rounded-2xl">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 mb-2">
                  🧪 Simulateur de Scan (Test Démo)
                </span>
                <p className="text-[10.5px] text-slate-400 mb-3 leading-tight">
                  L'environnement de prévisualisation peut bloquer l'accès à la caméra. Utilisez cette option pour simuler la capture d'un badge.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={simulatedStudentId}
                    onChange={(e) => setSimulatedStudentId(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-indigo-500 font-medium"
                  >
                    <option value="">-- Choisir un élève à simuler --</option>
                    {allStudents.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.classRoom})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!simulatedStudentId) {
                        alert("Veuillez sélectionner un élève à simuler.");
                        return;
                      }
                      handleQRCodeDetected(simulatedStudentId);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-97 shrink-0"
                  >
                    <Scan className="h-4 w-4" /> Simuler Scan
                  </button>
                </div>
              </div>

            </div>

            {/* Right Area: Dynamic Scan Actions Case Study & History (5 columns) */}
            <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-4">
              
              {/* Dynamic state: Scanning active vs Student Details editing manually */}
              <div className="bg-slate-850 border border-slate-750 p-5 rounded-2xl flex-1 flex flex-col max-h-[460px] overflow-hidden">
                <AnimatePresence mode="wait">
                  {scannedStudent && scanMode === 'manual' ? (
                    <motion.form
                      key="manual-form"
                      initial={{ y: 15, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -15, opacity: 0 }}
                      onSubmit={handleManualSubmit}
                      className="space-y-4 flex flex-col h-full"
                    >
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-750">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          {isImageAvatar(scannedStudent.avatar) ? (
                            <img src={scannedStudent.avatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">{scannedStudent.avatar}</span>
                          )}
                        </div>
                        <div className="text-left">
                          <h4 className="font-bold text-sm text-white">{scannedStudent.name}</h4>
                          <p className="text-xs text-slate-400">{scannedStudent.grade} • {scannedStudent.classRoom}</p>
                        </div>
                      </div>

                      <div className="space-y-3 flex-1 overflow-y-auto">
                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Statut d'Émargement du jour</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'Present', label: 'Présent', color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' },
                              { id: 'Late', label: 'Retard / Tardif', color: 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' },
                              { id: 'Absent', label: 'Absence non jus.', color: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' },
                              { id: 'Excused', label: 'Absence excusée', color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20' }
                            ].map((stat) => (
                              <button
                                key={stat.id}
                                type="button"
                                onClick={() => setSelectedStatus(stat.id as AttendanceStatus)}
                                className={`p-2 rounded-xl text-xs border text-center transition cursor-pointer font-bold ${
                                  selectedStatus === stat.id
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                                    : stat.color
                                }`}
                              >
                                {stat.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Commentaires ou excuses</label>
                          <input
                            type="text"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Ex: Tuteur a prévenu par téléphone"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2.5 pt-3 border-t border-slate-750">
                        <button
                          type="button"
                          onClick={handleCancelScanned}
                          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition cursor-pointer text-slate-300"
                        >
                          Annuler / Rescan
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 text-white active:scale-97 disabled:opacity-50"
                        >
                          {submitting ? (
                            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              <span>Enregistrer</span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.div
                      key="waiting-feed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col justify-center items-center text-center p-6 space-y-3 relative group"
                    >
                      {scanningActive ? (
                        <>
                          <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center animate-pulse shadow-inner">
                            <Camera className="h-7 w-7 text-indigo-400" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-white flex items-center justify-center gap-1">
                              En attente de scan...
                            </h4>
                            <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                              Placez un QR code scolaire ou un badge d'élève dans la zone de capture de l'appareil photo.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center">
                            <span className="h-6 w-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-white">Traitement en cours...</h4>
                            <p className="text-xs text-slate-400">Évaluation des métadonnées du badge scolaire.</p>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dynamic session list of logged students (History of this session scans) */}
              <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl flex-1 flex flex-col min-h-[160px] max-h-[300px]">
                <div className="flex items-center justify-between border-b border-slate-750 pb-2 mb-2 select-none">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" /> Historique de la Session ({successLogs.length})
                  </span>
                  
                  {successLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSuccessLogs([])}
                      className="text-[10px] text-slate-505 hover:text-slate-305 underline font-bold transition cursor-pointer"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 custom-scrollbar">
                  {successLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-6 select-none opacity-40">
                      <p className="text-[11px] text-slate-400">Aucun élève émargé depuis l'ouverture.</p>
                    </div>
                  ) : (
                    successLogs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-2 sm:p-2.5 bg-slate-800 rounded-xl border border-slate-750 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="text-left font-sans flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-xs shrink-0" />
                          <div>
                            <h5 className="font-bold text-white truncate max-w-[120px] sm:max-w-none">{log.studentName}</h5>
                            <span className="text-[9.5px] text-slate-400 leading-none">{log.time}</span>
                          </div>
                        </div>

                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-inner ${
                          log.status === 'Present' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : log.status === 'Late'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {log.status === 'Present' ? 'Présent' : log.status === 'Retard' ? 'Late' : log.status}
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
