import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, VideoOff, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student } from '../types';

interface StudentCameraModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedStudent: Student) => void;
}

export default function StudentCameraModal({ student, isOpen, onClose, onUpdate }: StudentCameraModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-initiate camera stream when modal opens in camera tab
  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, activeTab, facingMode]);

  const startCamera = async () => {
    setIsActivating(true);
    setCameraError(null);
    setPhoto(null);
    stopCamera();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400, facingMode: facingMode },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let expl = "Impossible d'accéder à l'appareil photo.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        expl = "L'accès à la caméra a été refusé par l'utilisateur ou le navigateur. Veuillez autoriser la caméra dans l'URL/les paramètres de votre navigateur.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        expl = "Aucun appareil photo n'a été trouvé sur ce périphérique.";
      }
      setCameraError(expl);
    } finally {
      setIsActivating(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // We want a square crop for the avatar
    const size = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Draw image cropped to a square center zone
      if (facingMode === 'user') {
        // Horizontally mirror the image on canvas to match user preview
        ctx.translate(300, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, startX, startY, size, size, 0, 0, 300, 300);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhoto(dataUrl);
      stopCamera();
    }
  };

  // Safe callback to read uploaded or dropped file
  const handleFileUpload = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Veuillez sélectionner uniquement une image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        const img = new Image();
        img.onload = () => {
          if (!canvasRef.current) {
            setPhoto(event.target.result as string);
            return;
          }
          const canvas = canvasRef.current;
          canvas.width = 300;
          canvas.height = 300;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Draw image center cropped to standard 300x300 square avatar
            const size = Math.min(img.width, img.height);
            const startX = (img.width - size) / 2;
            const startY = (img.height - size) / 2;
            ctx.drawImage(img, startX, startY, size, size, 0, 0, 300, 300);
            const croppedUrl = canvas.toDataURL('image/jpeg', 0.85);
            setPhoto(croppedUrl);
          } else {
            setPhoto(event.target.result as string);
          }
        };
        img.src = event.target.result;
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleSaveAvatar = async () => {
    if (!photo) return;

    setSaving(true);
    try {
      const studentDocRef = doc(db, 'students', student.id);
      await updateDoc(studentDocRef, { avatar: photo });
      
      onUpdate({
        ...student,
        avatar: photo
      });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `students/${student.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl w-full max-w-md border border-gray-150 shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-5 bg-indigo-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2 font-sans">
                  <Camera className="h-5 w-5" />
                  Avatar de {student.name}
                </h3>
                <p className="text-xs text-indigo-100">Personnalisez la photo de profil de votre enfant.</p>
              </div>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white cursor-pointer p-1 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('camera');
                  setPhoto(null);
                }}
                className={`flex-1 py-3 text-xs font-bold font-sans transition flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                  activeTab === 'camera'
                    ? 'border-indigo-600 text-indigo-700 bg-white font-extrabold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-slate-50'
                }`}
              >
                <Camera className="h-4 w-4" />
                Appareil Photo
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('upload');
                  setPhoto(null);
                  stopCamera();
                }}
                className={`flex-1 py-3 text-xs font-bold font-sans transition flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                  activeTab === 'upload'
                    ? 'border-indigo-600 text-indigo-700 bg-white font-extrabold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-slate-50'
                }`}
              >
                <Upload className="h-4 w-4" />
                Importer une Image
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              
              {/* Hidden canvas for image cropping */}
              <canvas ref={canvasRef} className="hidden" />

              {photo ? (
                /* Taken Snapshot or Uploaded Image preview */
                <div className="space-y-4">
                  <div className="relative aspect-square w-full max-w-xs mx-auto rounded-3xl overflow-hidden border-2 border-indigo-100 bg-slate-50 flex items-center justify-center shadow-lg">
                    <img
                      src={photo}
                      alt="Aperçu de la photo de profil"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[9px] uppercase font-bold px-2.5 py-0.5 rounded-full shadow-xs font-sans">
                      Aperçu recadré
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setPhoto(null);
                        if (activeTab === 'camera') startCamera();
                      }}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-97"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Recommencer
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSaveAvatar}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-150 disabled:opacity-50 active:scale-97"
                    >
                      {saving ? (
                        <>
                          <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                          Sauvegarde...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" /> Confirmer la Photo
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : activeTab === 'camera' ? (
                /* Camera Capture Section */
                <div className="space-y-4">
                  <div className="relative aspect-square w-full max-w-xs mx-auto rounded-2xl overflow-hidden border border-gray-250 bg-slate-900 flex items-center justify-center shadow-inner">
                    {isActivating && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-2">
                        <span className="h-8 w-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        <p className="text-[10px] font-mono tracking-wider text-slate-300">Mise en route de la caméra...</p>
                      </div>
                    )}

                    {cameraError && (
                      <div className="p-6 text-center space-y-4">
                        <div className="flex justify-center">
                          <VideoOff className="h-10 w-10 text-rose-500" />
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                          {cameraError}
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('upload')}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition"
                        >
                          <Upload className="h-4 w-4" /> Utiliser l'import de fichier
                        </button>
                      </div>
                    )}

                    {/* Live stream */}
                    {stream && (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} // horizontal mirror flip for better feel only on front cam
                        />
                        
                        {/* Face aligner guideline circles */}
                        <div className="absolute inset-0 border-[3px] border-dashed border-indigo-400/40 rounded-full m-8 pointer-events-none flex items-center justify-center">
                          <span className="text-[9px] uppercase font-bold text-indigo-100 bg-slate-900/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                            Centrer le visage ici
                          </span>
                        </div>

                        {/* Interactive Toggle for front/back camera (FacingMode switcher) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
                          }}
                          className="absolute top-3 right-3 p-2 bg-indigo-600/90 hover:bg-indigo-700 text-white border border-indigo-400/30 rounded-xl shadow-md transition-all hover:scale-110 active:scale-95 cursor-pointer z-10 flex items-center gap-1.5 text-[10.5px] font-black tracking-wide font-sans backdrop-blur-xs"
                          title="Changer d'appareil photo"
                        >
                          <RefreshCw className="h-3.5 w-3.5 animate-spin-slow" />
                          <span>{facingMode === 'user' ? 'Cam arrière' : 'Selfie'}</span>
                        </button>
                      </>
                    )}
                  </div>

                  {stream && (
                    <button
                      type="button"
                      onClick={handleCapture}
                      className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-extrabold text-xs hover:bg-indigo-700 transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-100 active:scale-97"
                    >
                      <Camera className="h-4 w-4" /> Capturer l'image
                    </button>
                  )}
                </div>
              ) : (
                /* Drag & Drop File Upload Section */
                <div className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative w-full aspect-square max-w-xs mx-auto rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all duration-300 ${
                      isDragging
                        ? 'border-indigo-600 bg-indigo-50/50 scale-102 shadow-inner'
                        : 'border-slate-250 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs mb-3 text-indigo-600">
                      <Upload className="h-8 w-8" />
                    </div>
                    
                    <h4 className="text-sm font-sans font-bold text-slate-800">
                      Glissez-déposez la photo ici
                    </h4>
                    
                    <p className="text-xs text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                      Format PNG, JPG ou JPEG (l'image sera automatiquement recadrée au format carré)
                    </p>

                    <div className="mt-4">
                      <label className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition active:scale-97">
                        <Upload className="h-3.5 w-3.5" /> Sélectionner un fichier
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
