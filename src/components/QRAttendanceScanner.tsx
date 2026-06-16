import React, { useEffect, useRef, useState } from 'react';
import { Student, Attendance } from '../types';
import jsQR from 'jsqr';
import { Camera, X, CheckCircle, AlertTriangle, RefreshCw, Settings, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QRAttendanceScannerProps {
  isOpen: boolean;
  onClose: () => void;
  studentsList: Student[];
  onLogAttendance: (student: Student) => Promise<boolean>;
}

export default function QRAttendanceScanner({
  isOpen,
  onClose,
  studentsList,
  onLogAttendance
}: QRAttendanceScannerProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  // Scan state managers
  const [scanStatus, setScanStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [lastScannedStudent, setLastScannedStudent] = useState<Student | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationIdRef = useRef<number | null>(null);

  // Play a quick synth audio tone to provide standard haptic/vocal scanners feedback
  const playSuccessBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn("Autoplay policy might have blocked haptic scan beep:", e);
    }
  };

  const playErrorTone = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // Low pitch A3
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("Autoplay policy might have blocked haptic scan beep:", e);
    }
  };

  // Turn on camera and start tracking frames
  const startCameraStream = async (deviceId?: string) => {
    setIsLoading(true);
    setCameraError(null);
    stopCameraStream();

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: { ideal: "environment" } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);

        // Fetch cameras lists for switcher
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        if (videoDevices.length > 0 && !selectedCameraId) {
          // Store default
          const currentTrack = stream.getVideoTracks()[0];
          const settings = currentTrack ? currentTrack.getSettings() : null;
          if (settings && settings.deviceId) {
            setSelectedCameraId(settings.deviceId);
          } else {
            setSelectedCameraId(videoDevices[0].deviceId);
          }
        }
      }

      setIsLoading(false);
      startScanLoop();
    } catch (err: any) {
      console.error("[QR Scanner] Camera Error: ", err);
      setCameraError(
        "Accès à la caméra refusé ou indisponible. Veuillez autoriser l'accès à l'appareil photo dans les paramètres du navigateur pour utiliser le scanner."
      );
      setIsLoading(false);
    }
  };

  const stopCameraStream = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Core frame-by-frame loop scanning canvas for valid qr code
  const startScanLoop = () => {
    const scanFrame = () => {
      if (!videoRef.current || !streamRef.current) return;

      const video = videoRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Render offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            handleQRDetected(code.data);
            return; // Pause the scan animation loop during processing & popup display
          }
        }
      }

      animationIdRef.current = requestAnimationFrame(scanFrame);
    };

    animationIdRef.current = requestAnimationFrame(scanFrame);
  };

  // Found QR! Match student record & log attendance
  const handleQRDetected = async (scannedId: string) => {
    setScanStatus('checking');
    
    // Look for matching student in list
    const foundStudent = studentsList.find(s => s.id === scannedId);

    if (!foundStudent) {
      playErrorTone();
      setScanStatus('error');
      setStatusMessage(`Code QR invalide ou élève non identifié.`);
      
      // Auto-resume scanner loop in 2 seconds
      setTimeout(() => {
        setScanStatus('idle');
        startScanLoop();
      }, 2000);
      return;
    }

    if (foundStudent.attendanceValidated) {
      playErrorTone();
      setScanStatus('error');
      setStatusMessage(`Impossible d'émarger : Le bulletin de d'assiduité de ${foundStudent.name} est validé et scellé.`);
      
      setTimeout(() => {
        setScanStatus('idle');
        startScanLoop();
      }, 2500);
      return;
    }

    try {
      // Execute the log attendance callback function
      const success = await onLogAttendance(foundStudent);
      
      if (success) {
        playSuccessBeep();
        setScanStatus('success');
        setLastScannedStudent(foundStudent);
        setStatusMessage(`${foundStudent.name} émargé(e) PRÉSENT(E) pour aujourd'hui !`);
      } else {
        playErrorTone();
        setScanStatus('error');
        setStatusMessage(`Erreur de droits ou d'enregistrement pour ${foundStudent.name}.`);
      }
    } catch (err) {
      console.error(err);
      playErrorTone();
      setScanStatus('error');
      setStatusMessage(`Impossible de sauvegarder la présence de ${foundStudent.name}.`);
    }

    // Hold screen and auto resume scan in 2 seconds
    setTimeout(() => {
      setLastScannedStudent(null);
      setScanStatus('idle');
      startScanLoop();
    }, 2200);
  };

  // Monitor open change
  useEffect(() => {
    if (isOpen) {
      startCameraStream();
    } else {
      stopCameraStream();
    }
    return () => stopCameraStream();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-55">
      <div className="bg-white rounded-3xl w-full max-w-xl border border-gray-150 shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-auto max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-150 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-550/25 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Camera className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black font-sans leading-tight">Scanner d'Émargement Flash</h3>
              <p className="text-[11px] text-slate-400 font-medium">Loguez instantanément les présences avec l'ID d'un élève</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
            title="Fermer le scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Main Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-950 text-white flex flex-col justify-center min-h-0">
          
          {cameraError ? (
            <div className="bg-red-950/40 border border-red-900/50 rounded-2xl p-6 text-center space-y-4 max-w-md mx-auto">
              <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-red-400">Accès caméra refusé</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {cameraError}
                </p>
              </div>
              <button
                onClick={() => startCameraStream(selectedCameraId)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer border border-indigo-500/50 shadow-md"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Recommencer à émettre
              </button>
            </div>
          ) : (
            <div className="relative flex-1 flex flex-col items-center justify-center min-h-0">
              
              {/* Webcam Video Box Viewport */}
              <div className="relative w-full max-w-sm aspect-square bg-slate-900 rounded-2xl border-2 border-slate-700/50 overflow-hidden flex items-center justify-center shrink-0 shadow-2xl">
                {isLoading && (
                  <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center gap-3 z-20">
                    <RefreshCw className="h-8 w-8 text-indigo-550 animate-spin" />
                    <p className="text-xs font-semibold text-slate-300">Initialisation de la caméra...</p>
                  </div>
                )}
                
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover transform"
                  playsInline
                  muted
                />

                {/* Overlays / Scanning Laser Box */}
                {cameraActive && scanStatus === 'idle' && (
                  <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                    {/* Targeting Box */}
                    <div className="w-56 h-56 border-2 border-dashed border-indigo-400/80 rounded-2xl relative">
                      {/* Laser Line */}
                      <div className="absolute inset-x-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-[scanLaser_2.5s_ease-in-out_infinite]" />
                      
                      {/* Corners indicator decorators */}
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-indigo-500 rounded-tl-sm" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-indigo-500 rounded-tr-sm" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-indigo-500 rounded-bl-sm" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-indigo-500 rounded-br-sm" />
                    </div>
                    {/* Dim outside targeting box backdrops */}
                    <div className="absolute top-0 inset-x-0 bg-slate-950/40 h-[calc(50%-112px)]" />
                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/40 h-[calc(50%-112px)]" />
                    <div className="absolute left-0 top-[calc(50%-112px)] w-[calc(50%-112px)] bottom-[calc(50%-112px)] bg-slate-950/40" />
                    <div className="absolute right-0 top-[calc(50%-112px)] w-[calc(50%-112px)] bottom-[calc(50%-112px)] bg-slate-950/40" />
                  </div>
                )}

                {/* Scan States feedback overlay cards */}
                <AnimatePresence>
                  {scanStatus !== 'idle' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center p-6 text-center"
                    >
                      {scanStatus === 'checking' && (
                        <div className="space-y-3.5">
                          <RefreshCw className="h-10 w-10 text-indigo-400 animate-spin mx-auto" />
                          <h4 className="text-sm font-bold text-slate-100">Traitement en cours...</h4>
                        </div>
                      )}

                      {scanStatus === 'success' && lastScannedStudent && (
                        <motion.div
                          initial={{ scale: 0.9, y: 15 }}
                          animate={{ scale: 1, y: 0 }}
                          className="space-y-4 max-w-xs"
                        >
                          <div className="h-14 w-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-2xl">
                            <CheckCircle className="h-8 w-8" />
                          </div>
                          
                          {/* Student visual card */}
                          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 text-left">
                            <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-slate-750 flex items-center justify-center bg-slate-800 font-sans text-xl">
                              {lastScannedStudent.avatar.startsWith('data:image') || lastScannedStudent.avatar.startsWith('http') ? (
                                <img src={lastScannedStudent.avatar} alt={lastScannedStudent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span>{lastScannedStudent.avatar}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-extrabold text-sm text-slate-100 truncate">{lastScannedStudent.name}</h5>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{lastScannedStudent.grade} • {lastScannedStudent.classRoom}</p>
                              <span className="text-[9px] bg-emerald-950/60 border border-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded-md font-bold text-left block w-fit mt-1 uppercase tracking-wide">✓ Présent</span>
                            </div>
                          </div>

                          <p className="text-[11px] font-bold text-emerald-400 leading-normal">
                            Émargement effectué avec succès !
                          </p>
                        </motion.div>
                      )}

                      {scanStatus === 'error' && (
                        <motion.div
                          initial={{ scale: 0.9, y: 15 }}
                          animate={{ scale: 1, y: 0 }}
                          className="space-y-3"
                        >
                          <div className="h-12 w-12 rounded-full bg-red-500/15 text-red-500 border border-red-500/25 flex items-center justify-center mx-auto">
                            <AlertTriangle className="h-6 w-6" />
                          </div>
                          <h4 className="text-sm font-bold text-red-400">Échec du scan</h4>
                          <p className="text-[11px] font-semibold text-slate-300 leading-normal max-w-[200px] mx-auto">
                            {statusMessage}
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Instructions bar */}
              <div className="text-center mt-5 space-y-2.5 px-4 shrink-0 max-w-sm">
                <p className="text-[11.5px] font-medium text-slate-300 leading-relaxed flex items-center gap-1.5 justify-center">
                  <Info className="h-4 w-4 text-indigo-400 shrink-0" />
                  Présentez le badge de l'élève face à la caméra pour enregistrer automatiquement sa présence.
                </p>
                <div className="flex justify-center gap-1.5">
                  <button
                    onClick={() => setShowSettings(prev => !prev)}
                    className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Choisir une autre caméra</span>
                  </button>
                </div>
              </div>

              {/* Camera Switcher Settings Panels */}
              {showSettings && availableCameras.length > 1 && (
                <div className="mt-4 p-3 bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm text-left animate-fade-in text-xs">
                  <label className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest block mb-2">Pource de capture vidéo</label>
                  <div className="space-y-1.5">
                    {availableCameras.map(camera => (
                      <button
                        key={camera.deviceId}
                        onClick={() => {
                          setSelectedCameraId(camera.deviceId);
                          startCameraStream(camera.deviceId);
                          setShowSettings(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg truncate text-slate-200 hover:bg-slate-800 flex items-center justify-between cursor-pointer ${
                          selectedCameraId === camera.deviceId ? 'bg-indigo-950 border border-indigo-900 text-indigo-300' : 'border border-transparent'
                        }`}
                      >
                        <span className="truncate">{camera.label || `Caméra #${availableCameras.indexOf(camera) + 1}`}</span>
                        {selectedCameraId === camera.deviceId && <span className="font-bold text-[9px] bg-indigo-900 border border-indigo-800 text-indigo-300 px-1 py-0.5 rounded-full uppercase">Actif</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center shrink-0">
          <div className="text-[9px] font-mono text-slate-500">
            PASMA-SYS REALTIME CAM CORE
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-bold uppercase transition rounded-xl cursor-pointer"
          >
            Fermer le Scanner
          </button>
        </div>

      </div>
    </div>
  );
}
