import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, VideoOff, Upload, ZoomIn, ZoomOut, RotateCw, Move, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db, OperationType } from '../firebase';
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
  
  // Image and Crop states
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState<number>(1);
  const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropRotation, setCropRotation] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);

  // Auto-initiate camera stream when modal opens in camera tab
  useEffect(() => {
    if (isOpen && activeTab === 'camera' && !rawImage) {
      startCamera();
    } else if (!isOpen || activeTab !== 'camera') {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, activeTab, facingMode]);

  // Ensure video element receives the stream as soon as both are present
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        console.warn("Autoplay camera stream was prevented or deferred:", e);
      });
    }
  }, [stream, activeTab]);

  const resetCrop = () => {
    setCropScale(1);
    setCropOffset({ x: 0, y: 0 });
    setCropRotation(0);
  };

  const startCamera = async () => {
    setIsActivating(true);
    setCameraError(null);
    setRawImage(null);
    resetCrop();
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Votre navigateur ne supporte pas l'accès direct à l'appareil photo ou l'accès est restreint. Veuillez importer un fichier image ci-dessus.");
      setIsActivating(false);
      return;
    }

    try {
      let mediaStream: MediaStream | null = null;

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false
        });
      } catch (err1) {
        console.warn("Tier 1 camera constraints failed, attempting Tier 2:", err1);
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: false
          });
        } catch (err2) {
          console.warn("Tier 2 camera constraints failed, falling back to default video track:", err2);
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (mediaStream) {
        setStream(mediaStream);
      } else {
        throw new Error("No media stream obtained.");
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let expl = "Impossible d'accéder à l'appareil photo.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        expl = "L'accès à la caméra a été refusé par l'utilisateur ou le navigateur. Veuillez autoriser la caméra dans la barre d'adresse de votre navigateur.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        expl = "Aucun appareil photo n'a été détecté sur cet appareil.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        expl = "L'appareil photo est actuellement utilisé par une autre application ou un autre onglet.";
      }
      setCameraError(expl);
    } finally {
      setIsActivating(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Error stopping camera track:", e);
        }
      });
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.save();
      if (facingMode === 'user') {
        ctx.translate(videoWidth, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setRawImage(dataUrl);
      resetCrop();
      stopCamera();
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Veuillez sélectionner uniquement une image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        setRawImage(event.target.result);
        resetCrop();
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

  // Pointer event handlers for dragging / panning the image in preview
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rawImage) return;
    setIsPanning(true);
    setPanStart({
      x: e.clientX - cropOffset.x,
      y: e.clientY - cropOffset.y
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setCropOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {
        // Safe fallback if capture release fails
      }
    }
  };

  // Renders the final cropped base64 image (300x300 avatar)
  const generateFinalCroppedImage = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!rawImage || !canvasRef.current) return resolve(rawImage || '');

      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        const targetSize = 300;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');

        if (!ctx) return resolve(rawImage);

        ctx.clearRect(0, 0, targetSize, targetSize);
        ctx.save();

        // 1. Move origin to center of square canvas
        ctx.translate(targetSize / 2, targetSize / 2);

        // 2. Rotate
        ctx.rotate((cropRotation * Math.PI) / 180);

        // 3. Compute scale
        const coverScale = Math.max(targetSize / img.width, targetSize / img.height);
        const drawWidth = img.width * coverScale * cropScale;
        const drawHeight = img.height * coverScale * cropScale;

        // 4. Draw with offset
        ctx.drawImage(
          img,
          -drawWidth / 2 + cropOffset.x,
          -drawHeight / 2 + cropOffset.y,
          drawWidth,
          drawHeight
        );

        ctx.restore();

        const finalUrl = canvas.toDataURL('image/jpeg', 0.90);
        resolve(finalUrl);
      };

      img.onerror = () => resolve(rawImage);
      img.src = rawImage;
    });
  };

  const handleSaveAvatar = async () => {
    if (!rawImage) return;

    setSaving(true);
    try {
      const croppedPhoto = await generateFinalCroppedImage();
      const studentDocRef = doc(db, 'students', student.id);
      await setDoc(studentDocRef, { avatar: croppedPhoto }, { merge: true });
      
      onUpdate({
        ...student,
        avatar: croppedPhoto
      });
      onClose();
    } catch (err) {
      console.warn("Firestore sync notice for student avatar:", err);
      // Fallback: update local state so photo is updated immediately
      const croppedPhoto = await generateFinalCroppedImage();
      onUpdate({
        ...student,
        avatar: croppedPhoto
      });
      onClose();
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
            className="bg-white rounded-3xl w-full max-w-md border border-gray-150 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-indigo-600 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black flex items-center gap-2 font-sans">
                  <Camera className="h-5 w-5" />
                  Avatar de {student.name}
                </h3>
                <p className="text-xs text-indigo-100">Prise de vue et alignement du visage pour le profil.</p>
              </div>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white cursor-pointer p-1 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('camera');
                  setRawImage(null);
                  resetCrop();
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
                  setRawImage(null);
                  resetCrop();
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
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              
              {/* Hidden canvas for image crop processing */}
              <canvas ref={canvasRef} className="hidden" />

              {rawImage ? (
                /* Interactive Crop & Alignment Tool */
                <div className="space-y-4">
                  
                  {/* Header notice */}
                  <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
                    <span className="flex items-center gap-1 text-indigo-600 font-bold">
                      <Sliders className="h-3.5 w-3.5" /> Outil de Recadrage
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      Glissez pour ajuster
                    </span>
                  </div>

                  {/* Interactive Crop Viewport */}
                  <div
                    ref={previewBoxRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="relative aspect-square w-full max-w-[280px] mx-auto rounded-3xl overflow-hidden border-2 border-indigo-200 bg-slate-950 shadow-xl cursor-grab active:cursor-grabbing select-none touch-none flex items-center justify-center"
                  >
                    {/* The transformable raw image */}
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropScale}) rotate(${cropRotation}deg)`,
                        transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                      }}
                    >
                      <img
                        src={rawImage}
                        alt="Photo à recadrer"
                        className="w-full h-full object-cover pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Circular Face Guide Overlay */}
                    <div className="absolute inset-0 border-[3px] border-dashed border-white/80 rounded-full m-5 pointer-events-none flex flex-col items-center justify-between p-4 bg-slate-900/10 backdrop-blur-[1px]">
                      <span className="text-[8.5px] uppercase font-black tracking-wider text-white bg-indigo-900/80 px-2.5 py-0.5 rounded-full shadow-xs border border-white/20">
                        Zone de photo d'identité
                      </span>
                      <div className="flex items-center gap-1 text-white/90 text-[9.5px] font-medium bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-xs">
                        <Move className="h-3 w-3 animate-pulse text-indigo-300" />
                        <span>Glisser pour centrer le visage</span>
                      </div>
                    </div>
                  </div>

                  {/* Crop Controls Bar */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-3">
                    
                    {/* Zoom Slider */}
                    <div className="flex items-center gap-2">
                      <ZoomOut className="h-4 w-4 text-slate-500 shrink-0" />
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={cropScale}
                        onChange={(e) => setCropScale(parseFloat(e.target.value))}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        title="Zoomer la photo"
                      />
                      <ZoomIn className="h-4 w-4 text-slate-500 shrink-0" />
                      <span className="text-[11px] font-extrabold text-slate-700 w-11 text-right shrink-0">
                        {Math.round(cropScale * 100)}%
                      </span>
                    </div>

                    {/* Action buttons: Rotate & Reset */}
                    <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5">
                      <button
                        type="button"
                        onClick={() => setCropRotation((prev) => (prev + 90) % 360)}
                        className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 rounded-xl font-bold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-97"
                      >
                        <RotateCw className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Pivoter 90°</span>
                      </button>

                      <button
                        type="button"
                        onClick={resetCrop}
                        className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-250 text-slate-600 rounded-xl font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shadow-xs active:scale-97"
                        title="Réinitialiser l'alignement"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                        <span>Réinitialiser</span>
                      </button>
                    </div>
                  </div>

                  {/* Confirmation & Restart Buttons */}
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setRawImage(null);
                        resetCrop();
                        if (activeTab === 'camera') startCamera();
                      }}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-97"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Reprendre
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
                          Traitement...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" /> Valider la Photo
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : activeTab === 'camera' ? (
                /* Camera Capture Section */
                <div className="space-y-4">
                  <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-gray-250 bg-slate-900 flex items-center justify-center shadow-inner">
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
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer transition border border-slate-700"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Réessayer
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('upload')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition"
                          >
                            <Upload className="h-3.5 w-3.5" /> Importer un fichier
                          </button>
                        </div>
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
                          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                        />
                        
                        {/* Face aligner guideline circles */}
                        <div className="absolute inset-0 border-[3px] border-dashed border-indigo-400/50 rounded-full m-6 pointer-events-none flex items-center justify-center">
                          <span className="text-[9px] uppercase font-bold text-indigo-100 bg-slate-900/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                            Centrer le visage
                          </span>
                        </div>

                        {/* Interactive Toggle for front/back camera */}
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
                    className={`relative w-full aspect-square max-w-[280px] mx-auto rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-5 text-center transition-all duration-300 ${
                      isDragging
                        ? 'border-indigo-600 bg-indigo-50/50 scale-102 shadow-inner'
                        : 'border-slate-250 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-xs mb-2 text-indigo-600">
                      <Upload className="h-7 w-7" />
                    </div>
                    
                    <h4 className="text-xs font-sans font-bold text-slate-800">
                      Glissez-déposez la photo ici
                    </h4>
                    
                    <p className="text-[11px] text-slate-500 mt-1 max-w-[190px] leading-relaxed">
                      Format PNG, JPG ou JPEG. Vous pourrez ajuster le cadrage du visage ensuite.
                    </p>

                    <div className="mt-3">
                      <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition active:scale-97">
                        <Upload className="h-3.5 w-3.5" /> Parcourir
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

