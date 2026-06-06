import React, { useState, useEffect, useRef } from 'react';
import { 
  googleAccessToken, 
  loginWithGoogle, 
  logout as firebaseLogout, 
  setGoogleAccessToken 
} from '../firebase';
import { 
  HardDrive, 
  FolderPlus, 
  UploadCloud, 
  Download, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  RefreshCcw, 
  FileText, 
  FileCode, 
  Folder, 
  LogOut, 
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  FileDown,
  Cloud
} from 'lucide-react';
import { ApeeParent, Invoice, Student } from '../types';

interface DrivePortalProps {
  parents: ApeeParent[];
  invoices: Invoice[];
  students: Student[];
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  size?: string;
  createdTime?: string;
}

export default function DrivePortal({ parents, invoices, students }: DrivePortalProps) {
  const [token, setToken] = useState<string | null>(googleAccessToken);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBackupLoading, setIsBackupLoading] = useState<string | null>(null);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  
  // Weekly auto-backup states
  const [isAutoBackupEnabled, setIsAutoBackupEnabled] = useState<boolean>(() => {
    return localStorage.getItem('pasma_drive_auto_backup') === 'true';
  });
  const [lastAutoBackupTime, setLastAutoBackupTime] = useState<string | null>(() => {
    return localStorage.getItem('pasma_drive_last_auto_backup_timestamp');
  });

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pasma Backups Folder ID on Google Drive
  const [backupFolderId, setBackupFolderId] = useState<string | null>(() => {
    return localStorage.getItem('pasma_drive_backup_folder_id') || null;
  });

  // Sync state with firebase's cached token
  useEffect(() => {
    setToken(googleAccessToken);
  }, [googleAccessToken]);

  // Automated weekly APEE financial data backup routine
  const checkAndTriggerAutoBackup = async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;
    
    const isEnabled = localStorage.getItem('pasma_drive_auto_backup') === 'true';
    if (!isEnabled) return;

    const lastTimeStr = localStorage.getItem('pasma_drive_last_auto_backup_timestamp');
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    if (!lastTimeStr || (now - parseInt(lastTimeStr, 10)) > oneWeekMs) {
      console.log('[Auto-Backup] Commençant la sauvegarde automatique hebdomadaire...');
      try {
        const activeFolderId = await getOrCreateBackupFolder(activeToken);
        
        // Bundle complete Parents APEE directory along with all official payment invoices
        const autoBackupPayload = {
          parents,
          invoices,
          schoolBackupMeta: {
            appVersion: 'Pasma-sys v3.2',
            backupType: 'APEE_Weekly_Automated_Snapshot',
            totalParentsExported: parents.length,
            totalInvoicesExported: invoices.length,
            totalStudentsRegistered: students.length,
            generatedAt: new Date().toISOString()
          }
        };

        const content = JSON.stringify(autoBackupPayload, null, 2);
        const filename = `APEE_Weekly_AutoBackup_${new Date().toISOString().split('T')[0]}.json`;
        const mimeType = 'application/json';

        const fileBlob = new Blob([content], { type: mimeType });
        const metadata = {
          name: filename,
          mimeType: mimeType,
          parents: activeFolderId ? [activeFolderId] : undefined
        };

        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append("file", fileBlob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeToken}`
          },
          body: form
        });

        if (response.ok) {
          const uploadedFile = await response.json();
          localStorage.setItem('pasma_drive_last_auto_backup_timestamp', String(now));
          setLastAutoBackupTime(String(now));
          setBackupSuccessMsg(`[Sauvegarde Auto] Transfert hebdomadaire réussi : "${uploadedFile.name}" a été enregistré.`);
          setTimeout(() => setBackupSuccessMsg(null), 6000);
          loadDriveFiles();
        } else {
          console.warn("[Auto-Backup] Échec du statut de téléversement :", response.status);
        }
      } catch (err) {
        console.error("[Auto-Backup] Erreur lors de la tentative de sauvegarde auto hebdomadaire :", err);
      }
    }
  };

  const handleToggleAutoBackup = async (checked: boolean) => {
    setIsAutoBackupEnabled(checked);
    localStorage.setItem('pasma_drive_auto_backup', String(checked));
    if (checked && token) {
      await checkAndTriggerAutoBackup(token);
    }
  };

  // Load files when token is available or active
  useEffect(() => {
    if (token) {
      loadDriveFiles();
      checkAndTriggerAutoBackup(token);
    }
  }, [token, backupFolderId]);

  // Authenticate Drive
  const handleConnectDrive = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
      setToken(googleAccessToken);
    } catch (err) {
      console.error('Failed to authenticate Google Drive scope:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect Drive auth
  const handleDisconnectDrive = () => {
    setGoogleAccessToken(null);
    setToken(null);
    setFiles([]);
  };

  // List files from Google Drive
  const loadDriveFiles = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      // Query to list files either overall or inside our custom backup folder
      let query = "trashed = false";
      if (backupFolderId) {
        query += ` and '${backupFolderId}' in parents`;
      }
      
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,size,createdTime)&orderBy=createdTime desc`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          handleDisconnectDrive();
          throw new Error("L'accès Google Drive a expiré. Veuillez vous reconnecter.");
        }
        throw new Error("Erreur de récupération des fichiers Drive.");
      }

      const data = await res.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a dedicated Backups Folder
  const handleCreateBackupFolder = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const metadata = {
        name: 'Pasma-sys School Backups',
        mimeType: 'application/vnd.google-apps.folder'
      };

      const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!res.ok) throw new Error("Impossible de créer le dossier de sauvegarde.");

      const folder = await res.json();
      if (folder.id) {
        setBackupFolderId(folder.id);
        localStorage.setItem('pasma_drive_backup_folder_id', folder.id);
        setBackupSuccessMsg("Dossier de sauvegarde 'Pasma-sys School Backups' créé sur votre Drive !");
        setTimeout(() => setBackupSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Check or Auto-Create Backups Folder on Export
  const getOrCreateBackupFolder = async (authToken: string): Promise<string | null> => {
    if (backupFolderId) return backupFolderId;

    try {
      // Look for an existing folder first to avoid duplicates
      const query = "mimeType = 'application/vnd.google-apps.folder' and name = 'Pasma-sys School Backups' and trashed = false";
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          const folderId = searchData.files[0].id;
          setBackupFolderId(folderId);
          localStorage.setItem('pasma_drive_backup_folder_id', folderId);
          return folderId;
        }
      }

      // If not found, create it
      const metadata = {
        name: 'Pasma-sys School Backups',
        mimeType: 'application/vnd.google-apps.folder'
      };

      const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (res.ok) {
        const folder = await res.json();
        if (folder.id) {
          setBackupFolderId(folder.id);
          localStorage.setItem('pasma_drive_backup_folder_id', folder.id);
          return folder.id;
        }
      }
    } catch (e) {
      console.error("Error securing backup folder:", e);
    }
    return null;
  };

  // General Backup Upload to Google Drive
  const handleExportData = async (type: 'parents' | 'billing' | 'academic') => {
    if (!token) return;
    setIsBackupLoading(type);
    setBackupSuccessMsg(null);

    try {
      const activeFolderId = await getOrCreateBackupFolder(token);

      let content = '';
      let filename = '';
      let mimeType = 'application/json';

      if (type === 'parents') {
        content = JSON.stringify(parents, null, 2);
        filename = `APEE_Parents_Directory_Backup_${new Date().toISOString().split('T')[0]}.json`;
      } else if (type === 'billing') {
        content = JSON.stringify(invoices, null, 2);
        filename = `Pasma_Billing_Statements_Backup_${new Date().toISOString().split('T')[0]}.json`;
      } else if (type === 'academic') {
        content = JSON.stringify(students, null, 2);
        filename = `Pasma_Students_Academic_Directory_Backup_${new Date().toISOString().split('T')[0]}.json`;
      }

      const fileBlob = new Blob([content], { type: mimeType });
      const metadata = {
        name: filename,
        mimeType: mimeType,
        parents: activeFolderId ? [activeFolderId] : undefined
      };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append("file", fileBlob);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: form
      });

      if (!response.ok) throw new Error("Échec du téléversement de la sauvegarde.");

      const uploadedFile = await response.json();
      setBackupSuccessMsg(`Sauvegarde réussie : "${uploadedFile.name}" est disponible en ligne.`);
      setTimeout(() => setBackupSuccessMsg(null), 5000);
      loadDriveFiles();
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la sauvegarde : " + err.message);
    } finally {
      setIsBackupLoading(null);
    }
  };

  // Hard Delete with confirmation dialog
  const handleDeleteFile = async (fileId: string, filename: string) => {
    if (!token) return;
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir supprimer définitivement le fichier "${filename}" de votre espace Google Drive ? Cette action est irréversible.`
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error("Le fichier n'a pas pu être supprimé.");
      setBackupSuccessMsg(`Fichier "${filename}" supprimé avec succès.`);
      setTimeout(() => setBackupSuccessMsg(null), 3000);
      loadDriveFiles();
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Drag and Drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!token) {
      alert("Veuillez connecter votre compte Google Drive avant de glisser-déposer des fichiers.");
      return;
    }

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      await uploadPhysicalFile(droppedFiles[0]);
    }
  };

  const handleManualFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadPhysicalFile(e.target.files[0]);
    }
  };

  // Upload Physical file (drag-drop / browse) to school backup folder
  const uploadPhysicalFile = async (file: File) => {
    if (!token) return;
    setUploadStatus('uploading');
    setUploadError(null);

    try {
      const activeFolderId = await getOrCreateBackupFolder(token);

      const metadata = {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        parents: activeFolderId ? [activeFolderId] : undefined
      };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append("file", file);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,createdTime', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: form
      });

      if (!response.ok) throw new Error("Impossible de téléverser le fichier choisi.");

      const resData = await response.json();
      setUploadStatus('success');
      setBackupSuccessMsg(`Fichier "${resData.name}" ajouté avec succès sur Google Drive !`);
      setTimeout(() => setBackupSuccessMsg(null), 5000);
      loadDriveFiles();
    } catch (err: any) {
      console.error(err);
      setUploadStatus('error');
      setUploadError(err.message || "Échec du téléversement.");
    } finally {
      setTimeout(() => {
        setUploadStatus('idle');
      }, 4000);
    }
  };

  const formatBytes = (bytesStr?: string) => {
    if (!bytesStr) return 'Taille inconnue';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return 'N/A';
    if (bytes === 0) return '0 octet';
    const k = 1024;
    const sizes = ['octets', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter files by query
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans leading-relaxed" id="pasma-google-drive-portal">
      {/* Banner / Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 py-8 px-6 text-white text-left relative overflow-hidden shadow-md">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 rounded-full text-[9px] font-black tracking-widest bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase">
                Intégration Offizielle Cloud
              </span>
              <div className="flex items-center gap-1 text-[8.5px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-3xs">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                <span>Sécurité SSL</span>
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
              Espace Documentaire & Sauvegardes Google Drive™
            </h1>
            <p className="text-xs text-slate-400 leading-normal font-medium">
              Exportez, sécurisez et partagez en temps réel les données de l'établissement (APEE, Régies Financières, Bulletins scolaires) directement de Pasma-sys vers votre espace cloud chiffré Google Drive.
            </p>
          </div>
          
          {/* Auth Button */}
          <div className="shrink-0">
            {token ? (
              <div className="flex items-center gap-2.5 bg-slate-850 border border-slate-700/60 p-2 pl-3 rounded-2xl shadow-xs">
                <div className="relative">
                  <div className="h-4.5 w-4.5 absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-white block animate-pulse" />
                  </div>
                  <div className="h-10 w-10 rounded-full bg-indigo-650 flex items-center justify-center font-black text-xs text-white uppercase shadow-sm">
                    GD
                  </div>
                </div>
                <div className="text-left pr-2">
                  <p className="text-xs font-black text-slate-200">Google Drive Connecté</p>
                  <button 
                    onClick={handleDisconnectDrive}
                    className="text-[9px] font-bold text-slate-400 hover:text-red-400 transition flex items-center gap-1 cursor-pointer mt-0.5 uppercase tracking-wider"
                  >
                    <LogOut className="h-2.5 w-2.5" />
                    Déconnexion
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleConnectDrive}
                disabled={isLoading}
                className="gsi-material-button text-xs py-2 px-4 shadow-md bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 cursor-pointer transition flex items-center gap-2 "
                style={{ height: '3.2rem', padding: '0 1.5rem', borderRadius: '14px' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 shrink-0">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="block w-full h-full">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                  </div>
                  <span className="font-extrabold text-[#1f1f1f] text-sm font-sans tracking-wide">Activer Google Drive</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Sandbox Workspace Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Alerts Center */}
        {backupSuccessMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-3xl text-xs text-emerald-800 font-bold flex items-center gap-3 shadow-2xs text-left animate-fade-in">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            <span className="flex-1">{backupSuccessMsg}</span>
          </div>
        )}

        {!token ? (
          /* Locked State Preview */
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center max-w-xl mx-auto my-12 space-y-6">
            <div className="h-16 w-16 bg-indigo-50 text-indigo-650 rounded-full flex items-center justify-center mx-auto shadow-2xs">
              <HardDrive className="h-8 w-8 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-extrabold text-slate-850">Avis d'authentification Google</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                Pour des raisons de sécurité, l'établissement Pasma-sys requiert un jeton OAuth sécurisé de Google pour pouvoir écrire et lister des fichiers sur votre cloud personnel.
              </p>
            </div>
            <button
              onClick={handleConnectDrive}
              disabled={isLoading}
              className="py-3 px-6 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition transform hover:scale-101 cursor-pointer inline-flex items-center gap-2"
            >
              <HardDrive className="h-4 w-4" />
              <span>Connecter mon Google Drive sécurisé</span>
            </button>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-4 text-[9.5px] font-bold text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                Auth chiffré par Google
              </span>
              <span>•</span>
              <span>Propriété exclusive de vos données</span>
            </div>
          </div>
        ) : (
          /* Document Sharing Center Dashboard Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Cloud Actions & Backups Generators (Span 4) */}
            <div className="lg:col-span-4 space-y-6 text-left">
              
              {/* Folder Info / Controls */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Folder className="h-4 w-4 text-indigo-600" />
                    Dossier Destinataire
                  </h3>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                    APEE Cloud v1.0
                  </span>
                </div>

                {backupFolderId ? (
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold text-slate-900 bg-slate-50 border border-slate-150 p-3 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="h-5 w-5 text-indigo-650 shrink-0" />
                        <div className="truncate">
                          <p className="font-extrabold truncate">Pasma-sys School Backups</p>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{backupFolderId}</p>
                        </div>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-3xs shrink-0" title="Actif et connecté" />
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Tous les rapports créés et les sauvegardes faites seront archivés dans ce dossier pour éviter d'encombrer votre Drive général.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5 text-xs text-slate-500 leading-normal p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl">
                    <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      Aucun dossier de sauvegarde
                    </p>
                    <p className="text-[10.5px]">
                      Afin de mieux classifier vos documents, nous vous conseillons de générer un dossier dédié 'Pasma-sys School Backups' sur votre Drive.
                    </p>
                    <button
                      onClick={handleCreateBackupFolder}
                      disabled={isLoading}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-2xs transition shadow-3xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      Créer le dossier Pasma-sys
                    </button>
                  </div>
                )}
              </div>

              {/* Automatic Weekly Auto-Backup Setting Card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Cloud className="h-4 w-4 text-indigo-650 animate-pulse" />
                    Sauvegarde Auto (APEE)
                  </h3>
                  <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                    Hebdomadaire
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-slate-800">Auto-Backup APEE</p>
                    <p className="text-[10px] text-slate-450 leading-relaxed">
                      Téléverser automatiquement un instantané complet des finances de l'APEE tous les 7 jours.
                    </p>
                  </div>
                  
                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={isAutoBackupEnabled}
                      onChange={(e) => handleToggleAutoBackup(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650" />
                  </label>
                </div>

                {isAutoBackupEnabled && (
                  <div className="p-3 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl text-[10px] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-450">Statut:</span>
                      <span className="font-black text-indigo-700 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 bg-indigo-650 rounded-full animate-ping" />
                        Actif (Chaque 7 j)
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-0.5 border-t border-indigo-100/30">
                      <span className="font-medium text-slate-450">Dernier export:</span>
                      <span className="font-bold text-slate-650 font-mono">
                        {lastAutoBackupTime 
                          ? new Date(parseInt(lastAutoBackupTime, 10)).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Jamais exécuté'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-450">Prochaine due:</span>
                      <span className="font-bold text-slate-650 font-mono">
                        {lastAutoBackupTime 
                          ? new Date(parseInt(lastAutoBackupTime, 10) + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          : 'Au chargement'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-indigo-100/40">
                      <button
                        type="button"
                        onClick={async () => {
                          const forceConfirmed = window.confirm("Souhaitez-vous déclencher la sauvegarde automatique hebdomadaire immédiatement ? Ceci réinitialisera le calcul des 7 jours.");
                          if (forceConfirmed) {
                            localStorage.removeItem('pasma_drive_last_auto_backup_timestamp');
                            await checkAndTriggerAutoBackup(token || undefined);
                          }
                        }}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] rounded-xl cursor-pointer transition shadow-3xs"
                      >
                        Lancer le backup automatique maintenant
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Automatic Database Exporters */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4 text-indigo-600" />
                    Sauvegardes Pasma-sys
                  </h3>
                </div>

                <p className="text-[10.5px] text-slate-400 leading-normal">
                  Chiffrez et exportez instantanément les bases de données SQL locales de l'école directement dans votre dossier de stockage cloud.
                </p>

                <div className="space-y-2.5 pt-1">
                  {/* Backup 1: Parents */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-2xl">
                    <div className="space-y-0.5">
                      <span className="text-[10.5px] font-black block text-slate-800">Fichier de l'APEE</span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">{parents.length} Dossiers parents</span>
                    </div>
                    <button
                      onClick={() => handleExportData('parents')}
                      disabled={isBackupLoading !== null}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold text-[10px] rounded-xl cursor-pointer transition shadow-3xs flex items-center gap-1"
                    >
                      {isBackupLoading === 'parents' ? (
                        <span className="animate-spin inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <FileDown className="h-3.5 w-3.5" />
                      )}
                      <span>Sauvegarder</span>
                    </button>
                  </div>

                  {/* Backup 2: Billing Statements */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-2xl">
                    <div className="space-y-0.5">
                      <span className="text-[10.5px] font-black block text-slate-800">Factures & Régie Financière</span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">{invoices.length} Reçus de paiement</span>
                    </div>
                    <button
                      onClick={() => handleExportData('billing')}
                      disabled={isBackupLoading !== null}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold text-[10px] rounded-xl cursor-pointer transition shadow-3xs flex items-center gap-1"
                    >
                      {isBackupLoading === 'billing' ? (
                        <span className="animate-spin inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <FileDown className="h-3.5 w-3.5" />
                      )}
                      <span>Sauvegarder</span>
                    </button>
                  </div>

                  {/* Backup 3: Academic Register */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-2xl">
                    <div className="space-y-0.5">
                      <span className="text-[10.5px] font-black block text-slate-800">Répertoire Académique</span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">{students.length} Élèves inscrits</span>
                    </div>
                    <button
                      onClick={() => handleExportData('academic')}
                      disabled={isBackupLoading !== null}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold text-[10px] rounded-xl cursor-pointer transition shadow-3xs flex items-center gap-1"
                    >
                      {isBackupLoading === 'academic' ? (
                        <span className="animate-spin inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <FileDown className="h-3.5 w-3.5" />
                      )}
                      <span>Sauvegarder</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: File sharing explorer & Manual Drag n' Drop Upload Center (Span 8) */}
            <div className="lg:col-span-8 space-y-6 text-left">
              
              {/* Drag & Drop File Upload Panel */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`bg-white rounded-3xl border-2 border-dashed p-6 text-center transition relative ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-50/40 shadow-xs' 
                    : 'border-slate-250 hover:border-slate-350 bg-white'
                }`}
              >
                <input
                  type="file"
                  id="drive-physical-file-upload-input"
                  ref={fileInputRef}
                  onChange={handleManualFileSelect}
                  className="hidden"
                />

                <div className="space-y-3.5 max-w-lg mx-auto">
                  <div className="h-12 w-12 bg-indigo-50/80 text-indigo-650 rounded-full flex items-center justify-center mx-auto shadow-3xs">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                      {isDragging ? "Déposez votre fichier maintenant !" : "Glissez-déposez un fichier de classe ici"}
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-normal mt-1">
                      Idéal pour envoyer un bulletin PDF de l'élève, des listes de fournitures d'élèves ou des justificatifs d'examens directement pour sauvegarde.
                    </p>
                  </div>

                  {uploadStatus === 'uploading' && (
                    <div className="flex items-center justify-center gap-2 p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-[10.5px] font-bold">
                      <span className="animate-spin h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full" />
                      Téléversement en cours sur Google Drive...
                    </div>
                  )}

                  {uploadStatus === 'error' && (
                    <div className="flex items-center justify-center gap-1.5 p-2 bg-red-50 border border-red-100 rounded-xl text-red-700 text-[10.5px] font-bold">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      {uploadError || "Erreur de téléversement."}
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10.5px] rounded-xl cursor-pointer transition select-none inline-flex items-center gap-1.5"
                    >
                      Parcourir les fichiers locaux
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Files Explorer / Browser inside Google Drive App Folder */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                      <HardDrive className="h-4 w-4 text-indigo-650" />
                      Explorateur du dossier scolaire
                    </h3>
                    <p className="text-[9.5px] text-slate-400 leading-none">
                      {filteredFiles.length} fichiers listés en synchronisation temps-réel
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Rechercher par nom..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8.5 pr-3 py-1.5 hover:border-slate-350 border border-slate-250 bg-white rounded-xl text-[10.5px] focus:outline-hidden focus:border-indigo-500 w-44 transition text-left"
                      />
                    </div>

                    <button
                      onClick={loadDriveFiles}
                      disabled={isLoading}
                      className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl transition text-slate-500 cursor-pointer disabled:opacity-40"
                      title="Rafraîchir"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isLoading && files.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <span className="animate-spin inline-block h-8 w-8 border-3 border-indigo-650 border-t-transparent rounded-full" />
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest">Chargement de votre Drive...</p>
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <FileText className="h-10 w-10 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-550">Aucun fichier trouvé</p>
                    <p className="text-[10px] text-slate-450 leading-relaxed max-w-sm mx-auto">
                      {searchQuery 
                        ? "Modifiez votre critère de recherche." 
                        : "Les sauvegardes et téléversements apparaîtront ici dès que vous aurez effectué votre première action."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredFiles.map((f) => {
                      const isJson = f.mimeType.includes('json');
                      const fileDate = f.createdTime ? new Date(f.createdTime).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Date inconnue';

                      return (
                        <div key={f.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition">
                          <div className="flex items-center gap-3 truncate min-w-0">
                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isJson ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                            }`}>
                              {isJson ? <FileCode className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                            </div>
                            
                            <div className="truncate text-left space-y-0.5">
                              <p className="text-xs font-extrabold text-slate-850 truncate" title={f.name}>
                                {f.name}
                              </p>
                              <div className="flex items-center gap-3 text-[9.5px] font-bold text-slate-400 font-mono">
                                <span>{formatBytes(f.size)}</span>
                                <span>•</span>
                                <span>{fileDate}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {f.webViewLink && (
                              <a
                                href={f.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition cursor-pointer"
                                title="Afficher en ligne ou télécharger"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteFile(f.id, f.name)}
                              className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl transition cursor-pointer"
                              title="Supprimer définitivement"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
