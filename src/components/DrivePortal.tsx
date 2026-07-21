import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../utils/TranslationContext';
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
  Cloud,
  HelpCircle,
  Layers,
  Settings2,
  BookOpen
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
  const { language, t } = useLanguage();
  const [token, setToken] = useState<string | null>(googleAccessToken);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBackupLoading, setIsBackupLoading] = useState<string | null>(null);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  
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
  const [showConfigGuide, setShowConfigGuide] = useState(false);

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
          setBackupSuccessMsg(
            language === 'en'
              ? `[Auto-Backup] Weekly upload succeeded: "${uploadedFile.name}" has been saved.`
              : `[Sauvegarde Auto] Transfert hebdomadaire réussi : "${uploadedFile.name}" a été enregistré.`
          );
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
    setAuthError(null);
    try {
      await loginWithGoogle();
      setToken(googleAccessToken);
    } catch (err: any) {
      console.error('Failed to authenticate Google Drive scope:', err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('popup-closed-by-user') || errMsg.includes('popup-blocked')) {
        setAuthError(
          language === 'en'
            ? "A pop-up block was detected. Since Pasma-sys runs inside an AI Studio preview iframe, your browser automatically blocks Google authentication pop-ups."
            : "Un blocage de fenêtre pop-up a été détecté. Comme Pasma-sys s'exécute à l'intérieur d'un iframe d'aperçu, votre navigateur bloque automatiquement les pop-ups d'authentification Google."
        );
      } else {
        setAuthError(
          language === 'en'
            ? `Authentication failed: ${errMsg}`
            : `Échec de l'authentification : ${errMsg}`
        );
      }
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
      let activeFolderId = backupFolderId;

      // Auto-discover the backup folder if it exists on Google Drive but the ID is missing from local storage
      if (!activeFolderId) {
        try {
          const folderQuery = "mimeType = 'application/vnd.google-apps.folder' and name = 'Pasma-sys School Backups' and trashed = false";
          const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id)`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (folderRes.ok) {
            const folderData = await folderRes.json();
            if (folderData.files && folderData.files.length > 0) {
              activeFolderId = folderData.files[0].id;
              setBackupFolderId(activeFolderId);
              localStorage.setItem('pasma_drive_backup_folder_id', activeFolderId);
            }
          }
        } catch (err) {
          console.warn("Auto-discovering backup folder failed:", err);
        }
      }

      // Query to list files either overall or inside our custom backup folder
      let query = "trashed = false";
      if (activeFolderId) {
        query += ` and '${activeFolderId}' in parents`;
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
          throw new Error(
            language === 'en'
              ? "Google Drive access expired. Please log in again."
              : "L'accès Google Drive a expiré. Veuillez vous reconnecter."
          );
        }
        throw new Error(
          language === 'en'
            ? "Error retrieving Drive files."
            : "Erreur de récupération des fichiers Drive."
        );
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

      if (!res.ok) {
        throw new Error(
          language === 'en'
            ? "Impossible to create storage folder."
            : "Impossible de créer le dossier de sauvegarde."
        );
      }

      const folder = await res.json();
      if (folder.id) {
        setBackupFolderId(folder.id);
        localStorage.setItem('pasma_drive_backup_folder_id', folder.id);
        setBackupSuccessMsg(
          language === 'en'
            ? "Backup folder 'Pasma-sys School Backups' created on your Drive!"
            : "Dossier de sauvegarde 'Pasma-sys School Backups' créé sur votre Drive !"
        );
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

      if (!response.ok) {
        throw new Error(
          language === 'en'
            ? "Upload of backup file failed."
            : "Échec du téléversement de la sauvegarde."
        );
      }

      const uploadedFile = await response.json();
      setBackupSuccessMsg(
        language === 'en'
          ? `Backup completed successfully: "${uploadedFile.name}" is now available online.`
          : `Sauvegarde réussie : "${uploadedFile.name}" est disponible en ligne.`
      );
      setTimeout(() => setBackupSuccessMsg(null), 5000);
      loadDriveFiles();
    } catch (err: any) {
      console.error(err);
      alert(
        (language === 'en' ? "Error performing backup: " : "Erreur lors de la sauvegarde : ") +
          err.message
      );
    } finally {
      setIsBackupLoading(null);
    }
  };

  // Hard Delete with confirmation dialog
  const handleDeleteFile = async (fileId: string, filename: string) => {
    if (!token) return;
    const confirmed = window.confirm(
      language === 'en'
        ? `Are you sure you want to permanently delete the file "${filename}" from your Google Drive? This action is irreversible.`
        : `Êtes-vous sûr de vouloir supprimer définitivement le fichier "${filename}" de votre espace Google Drive ? Cette action est irréversible.`
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

      if (!res.ok) {
        throw new Error(
          language === 'en'
            ? "The file could not be deleted."
            : "Le fichier n'a pas pu être supprimé."
        );
      }
      setBackupSuccessMsg(
        language === 'en'
          ? `File "${filename}" successfully deleted.`
          : `Fichier "${filename}" supprimé avec succès.`
      );
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
      alert(
        language === 'en'
          ? "Please connect your Google Drive account before dragging and dropping files."
          : "Veuillez connecter votre compte Google Drive avant de glisser-déposer des fichiers."
      );
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

      if (!response.ok) {
        throw new Error(
          language === 'en'
            ? "Impossible to upload selected file."
            : "Impossible de téléverser le fichier choisi."
        );
      }

      const resData = await response.json();
      setUploadStatus('success');
      setBackupSuccessMsg(
        language === 'en'
          ? `File "${resData.name}" successfully added to Google Drive!`
          : `Fichier "${resData.name}" ajouté avec succès sur Google Drive !`
      );
      setTimeout(() => setBackupSuccessMsg(null), 5000);
      loadDriveFiles();
    } catch (err: any) {
      console.error(err);
      setUploadStatus('error');
      setUploadError(
        err.message || (language === 'en' ? "Upload failed." : "Échec du téléversement.")
      );
    } finally {
      setTimeout(() => {
        setUploadStatus('idle');
      }, 4000);
    }
  };

  const formatBytes = (bytesStr?: string) => {
    if (!bytesStr) return language === 'en' ? 'Unknown size' : 'Taille inconnue';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return 'N/A';
    if (bytes === 0) return language === 'en' ? '0 bytes' : '0 octet';
    const k = 1024;
    const sizes = language === 'en' ? ['bytes', 'KB', 'MB', 'GB'] : ['octets', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter files by query
  const filteredFiles = files.filter(f => 
    f && f.name && (f.name || '').toLowerCase().includes((searchQuery || '').toLowerCase())
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
                {t('drive.integration')}
              </span>
              <div className="flex items-center gap-1 text-[8.5px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-3xs">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                <span>{t('drive.security')}</span>
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('drive.title')}
            </h1>
            <p className="text-xs text-slate-400 leading-normal font-medium">
              {t('drive.subtitle')}
            </p>
          </div>
          
          {/* Auth Button */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {token && (
              <button
                type="button"
                onClick={() => setShowConfigGuide(!showConfigGuide)}
                className={`text-[10.5px] font-extrabold px-3.5 py-2.5 rounded-2xl border transition uppercase tracking-wider cursor-pointer flex items-center gap-2 select-none h-[3.2rem] ${
                  showConfigGuide 
                    ? 'bg-indigo-650 hover:bg-indigo-700 text-white border-indigo-700 shadow-sm' 
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700/50 shadow-3xs'
                }`}
              >
                <HelpCircle className="h-4 w-4 shrink-0 text-indigo-400" />
                <span>{language === 'en' ? 'GCP Help' : 'Aide GCP'}</span>
              </button>
            )}
            {token ? (
              <div className="flex items-center gap-2.5 bg-slate-850 border border-slate-700/60 p-2 pl-3 rounded-2xl shadow-xs" style={{ height: '3.2rem' }}>
                <div className="relative">
                  <div className="h-4.5 w-4.5 absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-white block animate-pulse" />
                  </div>
                  <div className="h-10 w-10 rounded-full bg-indigo-650 flex items-center justify-center font-black text-xs text-white uppercase shadow-sm">
                    GD
                  </div>
                </div>
                <div className="text-left pr-2">
                  <p className="text-xs font-black text-slate-200">{t('drive.connected')}</p>
                  <button 
                    onClick={handleDisconnectDrive}
                    className="text-[9px] font-bold text-slate-400 hover:text-red-400 transition flex items-center gap-1 cursor-pointer mt-0.5 uppercase tracking-wider"
                  >
                    <LogOut className="h-2.5 w-2.5" />
                    {t('drive.disconnect')}
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
                  <span className="font-extrabold text-[#1f1f1f] text-sm font-sans tracking-wide">{t('drive.activate')}</span>
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
          /* Locked State Preview and Setup Guide */
          <div className="space-y-8 max-w-4xl mx-auto my-12">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 md:p-12 text-center max-w-xl mx-auto space-y-6">
            <div className="h-16 w-16 bg-indigo-50 text-indigo-650 rounded-full flex items-center justify-center mx-auto shadow-2xs">
              <HardDrive className="h-8 w-8 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-extrabold text-slate-850">{t('drive.auth_notice_title')}</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                {t('drive.auth_notice_desc')}
              </p>
            </div>

            {authError && (
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs text-amber-900 space-y-3 shadow-3xs animate-fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-amber-950 mb-1">{t('drive.popup_blocked_title')}</h4>
                    <p className="text-[11px] text-amber-850 leading-relaxed">
                      {t('drive.popup_blocked_desc')}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-amber-850 space-y-2 pt-2 border-t border-amber-200/55 pl-7">
                  <p className="font-semibold">{t('drive.popup_solve_title')}</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      {t('drive.popup_solve_step1')}
                    </li>
                    <li>
                      {t('drive.popup_solve_step2')}
                    </li>
                    <li>
                      {t('drive.popup_solve_step3')}
                    </li>
                  </ul>
                </div>
              </div>
            )}

            <button
              onClick={handleConnectDrive}
              disabled={isLoading}
              className="py-3 px-6 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition transform hover:scale-101 cursor-pointer inline-flex items-center gap-2"
            >
              <HardDrive className="h-4 w-4" />
              <span>{isLoading ? t('drive.connecting') : t('drive.connect_secure')}</span>
            </button>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-4 text-[9.5px] font-bold text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                {t('drive.auth_google')}
              </span>
              <span>•</span>
              <span>{t('drive.exclusive_prop')}</span>
            </div>
          </div>

          <GcpConsentGuide language={language} />
        </div>
      ) : (
        /* Document Sharing Center Dashboard Grid */
        <div className="space-y-8 animate-fade-in">
          {showConfigGuide && (
            <GcpConsentGuide language={language} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Cloud Actions & Backups Generators (Span 4) */}
            <div className="lg:col-span-4 space-y-6 text-left">
              
              {/* Folder Info / Controls */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Folder className="h-4 w-4 text-indigo-600" />
                    {t('drive.recipient_folder')}
                  </h3>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                    {t('drive.cloud_version')}
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
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-3xs shrink-0" title={t('drive.active_connected')} />
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      {t('drive.folder_desc')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5 text-xs text-slate-500 leading-normal p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl">
                    <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      {t('drive.no_folder_warning')}
                    </p>
                    <p className="text-[10.5px]">
                      {t('drive.no_folder_desc')}
                    </p>
                    <button
                      onClick={handleCreateBackupFolder}
                      disabled={isLoading}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-2xs transition shadow-3xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      {t('drive.create_folder_btn')}
                    </button>
                  </div>
                )}
              </div>

              {/* Automatic Weekly Auto-Backup Setting Card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Cloud className="h-4 w-4 text-indigo-650 animate-pulse" />
                    {t('drive.auto_backup')}
                  </h3>
                  <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                    {t('drive.weekly')}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-slate-800">{t('drive.auto_backup')}</p>
                    <p className="text-[10px] text-slate-450 leading-relaxed">
                      {t('drive.auto_backup_desc')}
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
                      <span className="font-medium text-slate-450">{t('drive.status')}</span>
                      <span className="font-black text-indigo-700 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 bg-indigo-650 rounded-full animate-ping" />
                        {t('drive.status_active')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-0.5 border-t border-indigo-100/30">
                      <span className="font-medium text-slate-450">{t('drive.last_export')}</span>
                      <span className="font-bold text-slate-650 font-mono">
                        {lastAutoBackupTime 
                          ? new Date(parseInt(lastAutoBackupTime, 10)).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : t('drive.never_executed')}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-450">{t('drive.next_due')}</span>
                      <span className="font-bold text-slate-650 font-mono">
                        {lastAutoBackupTime 
                          ? new Date(parseInt(lastAutoBackupTime, 10) + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          : t('drive.at_loading')}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-indigo-100/40">
                      <button
                        type="button"
                        onClick={async () => {
                          const forceConfirmed = window.confirm(
                            language === 'en'
                              ? "Do you wish to trigger the weekly auto-backup immediately? This will reset the 7-day schedule."
                              : "Souhaitez-vous déclencher la sauvegarde automatique hebdomadaire immédiatement ? Ceci réinitialisera le calcul des 7 jours."
                          );
                          if (forceConfirmed) {
                            localStorage.removeItem('pasma_drive_last_auto_backup_timestamp');
                            await checkAndTriggerAutoBackup(token || undefined);
                          }
                        }}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] rounded-xl cursor-pointer transition shadow-3xs"
                      >
                        {t('drive.force_auto_backup')}
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
                    {t('drive.pasma_backups')}
                  </h3>
                </div>

                <p className="text-[10.5px] text-slate-400 leading-normal">
                  {t('drive.backups_desc')}
                </p>

                <div className="space-y-2.5 pt-1">
                  {/* Backup 1: Parents */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-2xl">
                    <div className="space-y-0.5">
                      <span className="text-[10.5px] font-black block text-slate-800">{t('drive.file_apee')}</span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">{t('drive.parents_count', { count: parents.length })}</span>
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
                      <span>{t('drive.backup_btn')}</span>
                    </button>
                  </div>

                  {/* Backup 2: Billing Statements */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-2xl">
                    <div className="space-y-0.5">
                      <span className="text-[10.5px] font-black block text-slate-800">{t('drive.file_billing')}</span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">{t('drive.invoices_count', { count: invoices.length })}</span>
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
                      <span>{t('drive.backup_btn')}</span>
                    </button>
                  </div>

                  {/* Backup 3: Academic Register */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-2xl">
                    <div className="space-y-0.5">
                      <span className="text-[10.5px] font-black block text-slate-800">{t('drive.file_academic')}</span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">{t('drive.students_count', { count: students.length })}</span>
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
                      <span>{t('drive.backup_btn')}</span>
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
                      {isDragging ? t('drive.drag_active') : t('drive.drag_prompt')}
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-normal mt-1">
                      {t('drive.drag_desc')}
                    </p>
                  </div>

                  {uploadStatus === 'uploading' && (
                    <div className="flex items-center justify-center gap-2 p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-[10.5px] font-bold">
                      <span className="animate-spin h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full" />
                      {t('drive.uploading')}
                    </div>
                  )}

                  {uploadStatus === 'error' && (
                    <div className="flex items-center justify-center gap-1.5 p-2 bg-red-50 border border-red-100 rounded-xl text-red-700 text-[10.5px] font-bold">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      {uploadError || (language === 'en' ? "Upload error." : "Erreur de téléversement.")}
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10.5px] rounded-xl cursor-pointer transition select-none inline-flex items-center gap-1.5"
                    >
                      {t('drive.browse_files')}
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
                      {t('drive.folder_explorer')}
                    </h3>
                    <p className="text-[9.5px] text-slate-400 leading-none">
                      {t('drive.files_synchronized', { count: filteredFiles.length })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder={t('drive.search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8.5 pr-3 py-1.5 hover:border-slate-350 border border-slate-250 bg-white rounded-xl text-[10.5px] focus:outline-hidden focus:border-indigo-500 w-44 transition text-left"
                      />
                    </div>

                    <button
                      onClick={loadDriveFiles}
                      disabled={isLoading}
                      className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl transition text-slate-500 cursor-pointer disabled:opacity-40"
                      title={t('drive.refresh')}
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isLoading && files.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <span className="animate-spin inline-block h-8 w-8 border-3 border-indigo-650 border-t-transparent rounded-full" />
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest">{t('drive.loading')}</p>
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <FileText className="h-10 w-10 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-550">{t('drive.no_files')}</p>
                    <p className="text-[10px] text-slate-450 leading-relaxed max-w-sm mx-auto">
                      {searchQuery 
                        ? t('drive.no_files_search')
                        : t('drive.no_files_desc')}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredFiles.map((f) => {
                      const isJson = f.mimeType.includes('json');
                      const fileDate = f.createdTime ? new Date(f.createdTime).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : t('drive.file_date');

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
                                title={t('drive.view_online')}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteFile(f.id, f.name)}
                              className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl transition cursor-pointer"
                              title={t('drive.delete_perm')}
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
        </div>
      )}

      </div>
    </div>
  );
}

// ==========================================
// Google Cloud Console Configuration Guide
// ==========================================
function GcpConsentGuide({ language }: { language: string }) {
  const [activeTab, setActiveTab] = useState<'bypass' | 'testUsers' | 'oauthConfig'>('bypass');
  const [googleWarningAdvanced, setGoogleWarningAdvanced] = useState(false);
  const [gcpStepClicked, setGcpStepClicked] = useState(false);

  // Content helper
  const isFr = language !== 'en';

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden text-left" id="gcp-consent-guide-card">
      {/* Guide Header Banner */}
      <div className="bg-slate-900 border-b border-slate-800 p-6 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider">
              {isFr ? "Guide d'Autorisation Google Cloud Console" : "Google Cloud Console Authorization Guide"}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium leading-none mt-1">
              {isFr ? "Résoudre durablement l'écran de blocage 'Application non validée'" : "Bypass and resolve the 'Application not verified' security screen"}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-extrabold bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded-full uppercase tracking-widest hidden sm:inline-block">
          GCP Support
        </span>
      </div>

      {/* Guide Content Grid */}
      <div className="p-6 md:p-8 space-y-6">
        {/* Intro Tip */}
        <div className="p-4 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl text-xs text-indigo-950 flex gap-3 items-start leading-relaxed">
          <HelpCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold">
              {isFr ? "Pourquoi cet écran s'affiche-t-il ?" : "Why does this warning occur?"}
            </p>
            <p className="text-[11px] text-slate-650 leading-relaxed">
              {isFr 
                ? "L'accès à Google Drive est un champ d'application (Scope) sensible. Google affiche une alerte de sécurité par défaut si l'application s'exécute en mode de test et n'a pas subi de validation d'entreprise (procédure payante de plusieurs semaines). En tant qu'administrateur ou testeur de Pasma-sys, vous pouvez contourner cela gratuitement en configurant correctement votre console de développement Google Cloud." 
                : "Google Drive manipulation is a highly restricted API scope. Google displays a warning by default when an API key is in Testing mode and has not undergone enterprise-level review. As a self-developer or school admin, you can bypass this limitation easily and free of charge."
              }
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 overflow-x-auto pb-px gap-1">
          <button
            onClick={() => setActiveTab('bypass')}
            className={`py-3 px-4 text-xs font-black tracking-wide border-b-2 whitespace-nowrap cursor-pointer transition flex items-center gap-2 select-none ${
              activeTab === 'bypass'
                ? 'border-indigo-650 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>{isFr ? "1. Passer outre l'alerte (Immédiat)" : "1. Bypass Warning (Fast)"}</span>
          </button>
          <button
            onClick={() => setActiveTab('testUsers')}
            className={`py-3 px-4 text-xs font-black tracking-wide border-b-2 whitespace-nowrap cursor-pointer transition flex items-center gap-2 select-none ${
              activeTab === 'testUsers'
                ? 'border-indigo-650 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            <Settings2 className="h-4 w-4" />
            <span>{isFr ? "2. Configurer les Comptes de Test" : "2. Configure Test Accounts"}</span>
          </button>
          <button
            onClick={() => setActiveTab('oauthConfig')}
            className={`py-3 px-4 text-xs font-black tracking-wide border-b-2 whitespace-nowrap cursor-pointer transition flex items-center gap-2 select-none ${
              activeTab === 'oauthConfig'
                ? 'border-indigo-650 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>{isFr ? "3. Écran de Consentement" : "3. Consent Parameters"}</span>
          </button>
        </div>

        {/* Tab 1: Bypass Screen */}
        {activeTab === 'bypass' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-fade-in">
            <div className="lg:col-span-7 space-y-4">
              <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                {isFr ? "Comment passer l'écran d'avertissement" : "How to click through the unverified app warning"}
              </h4>
              <p className="text-xs text-slate-500 leading-normal">
                {isFr 
                  ? "Lorsque vous ouvrez la fenêtre de connexion Google Drive pour la première fois, vous faites face à la page d'avertissement standard de Google. Suivez ces étapes simples pour autoriser Pasma-sys :"
                  : "When authenticating to Google Drive for the first time, Google restricts actions on the unverified screen. Bypassing it requires only two quick clicks on the warning panel itself:"
                }
              </p>
              <ul className="space-y-3.5 text-xs text-slate-650 pl-1">
                <li className="flex gap-2.5 items-start">
                  <span className="h-5 w-5 rounded-full bg-slate-900 border border-slate-700 text-white font-black flex items-center justify-center shrink-0 text-[10px]">1</span>
                  <span>
                    {isFr 
                      ? "Dans la popup, ne cliquez pas sur le bouton bleu principal 'Revenir en sécurité'. Cherchez plutôt le petit lien discret."
                      : "In the OAuth popup, do not select the primary blue 'Go back to safety' button. Look for the small styled link on the left."
                    }
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <span className="h-5 w-5 rounded-full bg-slate-900 border border-slate-700 text-white font-black flex items-center justify-center shrink-0 text-[10px]">2</span>
                  <span>
                    {isFr 
                      ? "Cliquez sur " 
                      : "Click on "
                    }
                    <strong className="text-slate-950 font-black">
                      {isFr ? "Paramètres Avancés" : "Advanced Settings"}
                    </strong>
                    {isFr 
                      ? " en bas à gauche de la boîte de dialogue Google pour déplier les options."
                      : " at the bottom-left of the Google warning dialog to expand security actions."
                    }
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <span className="h-5 w-5 rounded-full bg-slate-900 border border-slate-700 text-white font-black flex items-center justify-center shrink-0 text-[10px]">3</span>
                  <span>
                    {isFr 
                      ? "Cliquez sur le lien " 
                      : "Select the newly revealed link "
                    }
                    <strong className="text-red-650 font-black text-xs">
                      {isFr ? "Accéder à Pasma-sys (non sécurisé)" : "Go to Pasma-sys (unsafe)"}
                    </strong>
                    {isFr 
                      ? " tout en bas pour finaliser la connexion sécurisée."
                      : " at the bottom to trigger the secure connection flow."
                    }
                  </span>
                </li>
              </ul>
            </div>

            {/* Simulated Interactive Warning Prompt */}
            <div className="lg:col-span-5 bg-slate-50 p-5 border border-slate-200 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-150 pb-2 text-[10px] font-bold text-slate-400">
                <span>{isFr ? "SIMULATEUR DE POP-UP GOOGLE" : "SIMULATED GOOGLE POPUP"}</span>
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              </div>
              
              <div className="border border-slate-250/80 bg-white p-4.5 rounded-2xl shadow-3xs space-y-4 text-left font-sans text-xs">
                {/* Google logo markup */}
                <div className="flex gap-1 items-center pb-1">
                  <span className="font-extrabold text-[#4285F4] text-sm">G</span>
                  <span className="font-extrabold text-[#EA4335] text-sm">o</span>
                  <span className="font-extrabold text-[#FBBC05] text-sm font-sans font-medium">o</span>
                  <span className="font-extrabold text-[#4285F4] text-sm font-sans font-medium">g</span>
                  <span className="font-extrabold text-[#34A853] text-sm">l</span>
                  <span className="font-extrabold text-[#EA4335] text-sm">e</span>
                </div>

                <div className="flex gap-2 items-start text-slate-800">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-slate-900 text-[12.5px] leading-tight">
                      {isFr ? "Google n'a pas validé cette application" : "Google hasn't verified this app"}
                    </h5>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                      {isFr 
                        ? "Cette application n’a pas encore été validée par Google. Procédez uniquement si vous connaissez le développeur." 
                        : "This app hasn't been verified by Google yet. Only proceed if you trust the developer."
                      }
                    </p>
                  </div>
                </div>

                {/* Google Interactive Actions */}
                <div className="pt-2 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setGoogleWarningAdvanced(!googleWarningAdvanced)}
                      className="text-indigo-600 hover:text-indigo-700 font-extrabold text-[10px] underline cursor-pointer select-none"
                    >
                      {googleWarningAdvanced 
                        ? (isFr ? "[ Masquer ]" : "[ Hide ]")
                        : (isFr ? "Paramètres avancés" : "Advanced")
                      }
                    </button>
                    <div className="px-3.5 py-1.5 bg-[#1a73e8] text-white text-[10px] font-extrabold rounded-lg shadow-3xs select-none">
                      {isFr ? "Revenir en sécurité" : "Go back to safety"}
                    </div>
                  </div>

                  {/* Simulated Advanced Box */}
                  {googleWarningAdvanced ? (
                    <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2 animate-fade-in text-[10px]">
                      <p className="text-slate-500 leading-snug">
                        {isFr 
                          ? "Pasma-sys demande l'autorisation d'accéder à votre Google Drive. Si vous continuez, vous autorisez Pasma-sys à créer et utiliser vos documents." 
                          : "Pasma-sys requests access to your cloud documents. Continuing lets the app create and save your spreadsheets secure backups."
                        }
                      </p>
                      <span className="block text-red-600 font-black hover:text-red-700 underline cursor-pointer select-none font-mono text-[9.5px] break-all border border-red-200/40 bg-red-50 px-2 py-1 rounded-md mt-1">
                        👉 {isFr ? "Accéder à Pasma-sys (non sécurisé)" : "Go to Pasma-sys (unsafe)"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-center py-2 text-[9px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg">
                      {isFr ? "💡 Cliquez sur 'Paramètres avancés' pour simuler !" : "💡 Click 'Advanced' to simulate !"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Test Users */}
        {activeTab === 'testUsers' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-fade-in">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-600" />
                <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                  {isFr ? "Renseigner vos 'Utilisateurs de test' (GCP Console)" : "Register your 'Test Users' inside Google Cloud"}
                </h4>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                {isFr 
                  ? "Pour autoriser un compte Google (Gmail) à se connecter, vous devez vous assurer que son adresse e-mail figure dans les utilisateurs de test du projet Google Cloud. Sans cela, Google affichera l'erreur bloquante 'Erreur 403 : Access blocked'." 
                  : "To unlock authorization permissions, you must declare active client emails under the authorized Test Users directory inside your Gcp Console. Without this step, users will encounter a hard '403 Access Blocked' lock."
                }
              </p>
              
              <ol className="space-y-3.5 text-xs text-slate-650 pl-1">
                <li className="flex gap-2.5 items-start">
                  <span className="h-5 w-5 rounded-full bg-slate-900 border border-slate-700 text-white font-black flex items-center justify-center shrink-0 text-[10px]">1</span>
                  <span>
                    {isFr 
                      ? "Rendez-vous sur l'écran de consentement Google Cloud : " 
                      : "Go to your Google Client setup page: "
                    }
                    <a 
                      href="https://console.cloud.google.com/apis/credentials/consent" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-indigo-650 hover:underline font-extrabold inline-flex items-center gap-0.5"
                    >
                      console.cloud.google.com <ExternalLink className="h-3 w-3 inline-block align-baseline" />
                    </a>
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <span className="h-5 w-5 rounded-full bg-slate-900 border border-slate-700 text-white font-black flex items-center justify-center shrink-0 text-[10px]">2</span>
                  <span>
                    {isFr 
                      ? "Sélectionnez votre projet scolaire dans le menu du haut."
                      : "Select your active educational environment project inside the GCP top menu bar."
                    }
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <span className="h-5 w-5 rounded-full bg-slate-900 border border-slate-700 text-white font-black flex items-center justify-center shrink-0 text-[10px]">3</span>
                  <span>
                    {isFr 
                      ? "Faites défiler vers le bas jusqu'au bloc " 
                      : "Scroll down to the block titled "
                    }
                    <strong className="text-slate-900">{isFr ? "Utilisateurs de test (Test users)" : "Test users"}</strong>.
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <span className="h-5 w-5 rounded-full bg-slate-900 border border-slate-700 text-white font-black flex items-center justify-center shrink-0 text-[10px]">4</span>
                  <span>
                    {isFr 
                      ? "Cliquez sur " 
                      : "Click on "
                    }
                    <strong className="text-indigo-650">{isFr ? "+ AJOUTER DES UTILISATEURS" : "+ ADD USERS"}</strong> 
                    {isFr 
                      ? " et saisissez l'adresse e-mail de connexion (ex: jacquesbene301@gmail.com)." 
                      : " and enter your administrative Google address."
                    }
                  </span>
                </li>
              </ol>

              <div className="pt-1.5 text-2xs italic text-slate-400">
                {isFr 
                  ? "* Note : Vous pouvez enregistrer jusqu'à 100 comptes Gmail différents de testeurs sans jamais devoir passer par une validation commerciale de Google."
                  : "* Note: Testing mode supports up to 100 personalized test accounts without any fee or verification requirements."
                }
              </div>
            </div>

            {/* Simulated GCP List */}
            <div className="lg:col-span-5 bg-slate-950 p-5 border border-slate-800 rounded-3xl text-slate-100 font-mono text-[10px]">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                <span>{isFr ? "CONSOLE GOOGLE CLOUD" : "SIMULATED GCP WORKSPACE"}</span>
                <span className="h-2 w-2 rounded-full bg-green-500 shadow-3xs" />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-[11px] border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-100 font-sans">OAuth consent screen</span>
                  <span className="text-[9px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded uppercase leading-none">Testing</span>
                </div>

                <div className="bg-slate-900/40 p-3 border border-slate-850 rounded-xl space-y-3">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-slate-300 font-sans">{isFr ? "Utilisateurs de test" : "Test users"}</span>
                    <button 
                      type="button"
                      onClick={() => setGcpStepClicked(!gcpStepClicked)}
                      className="bg-indigo-650 hover:bg-indigo-600 text-white font-black text-[9px] px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer select-none"
                    >
                      <span>+ {isFr ? "AJOUTER" : "ADD USERS"}</span>
                    </button>
                  </div>

                  {gcpStepClicked && (
                    <div className="p-2 bg-indigo-950/80 border border-indigo-500/20 text-[9px] rounded-lg text-indigo-300 text-left animate-fade-in font-sans leading-relaxed">
                      {isFr ? "Saisissez l'adresse de l'utilisateur, puis cliquez sur Enregistrer." : "Input the Gmail address, then check save to register."}
                    </div>
                  )}

                  <div className="divide-y divide-slate-850 pt-1">
                    <div className="py-2 flex items-center justify-between text-[11px] font-mono">
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
                        <span>jacquesbene301@gmail.com</span>
                      </div>
                      <span className="text-[9px] text-slate-550 border border-slate-805 px-1 rounded">User 1</span>
                    </div>
                    <div className="py-2 flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 bg-slate-600 rounded-full" />
                        <span>{isFr ? "ecole.direction@gmail.com" : "school.director@gmail.com"}</span>
                      </div>
                      <span className="text-[9px] text-slate-800 border border-slate-855 px-1 rounded">User 2</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: OAuth Config */}
        {activeTab === 'oauthConfig' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-fade-in">
            <div className="lg:col-span-12 space-y-4">
              <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                {isFr ? "Paramètres recommandés pour l'Écran de Consentement OAuth" : "Technical Parameters for OAuth Consent Configuration"}
              </h4>
              <p className="text-xs text-slate-500 leading-normal font-medium">
                {isFr 
                  ? "Voici récapitulé le paramétrage nécessaire lors de la création de vos identifiants d'API Google pour contourner la validation commerciale :" 
                  : "These are the optimal settings to apply to ensure seamless Google Cloud database backups for school systems without paying heavy enterprise validations:"
                }
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="p-4.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-black text-slate-800 uppercase text-[10px] tracking-wide">
                    <span className="p-1 min-w-5 h-5 bg-indigo-50 border border-indigo-150 inline-flex items-center justify-center rounded-lg text-[9px] font-black text-indigo-750">A</span>
                    <span>User Type</span>
                  </div>
                  <p className="font-extrabold text-indigo-700 text-xs">Externe (External)</p>
                  <p className="text-[10px] text-slate-450 leading-relaxed font-medium">
                    {isFr 
                      ? "Permet d'autoriser tout compte Gmail régulier sans limites imposées par un domaine d'organisation d'entreprise Google Workspace." 
                      : "Enables connection of standard personal or work Gmail profiles without requiring standard school enterprise registration."
                    }
                  </p>
                </div>

                <div className="p-4.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-black text-slate-800 uppercase text-[10px] tracking-wide">
                    <span className="p-1 min-w-5 h-5 bg-indigo-50 border border-indigo-150 inline-flex items-center justify-center rounded-lg text-[9px] font-black text-indigo-750">B</span>
                    <span>Publishing Status</span>
                  </div>
                  <p className="font-extrabold text-indigo-700 text-xs">En cours de test (Testing)</p>
                  <p className="text-[10px] text-slate-450 leading-relaxed font-medium">
                    {isFr 
                      ? "Signale à Google que votre intégration est en développement. Ce mode évite le long et difficile processus d'évaluation." 
                      : "Confirms that the project is managed privately in Dev mode, which skips multi-week manual code review audits."
                    }
                  </p>
                </div>

                <div className="p-4.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-black text-slate-800 uppercase text-[10px] tracking-wide">
                    <span className="p-1 min-w-5 h-5 bg-indigo-50 border border-indigo-150 inline-flex items-center justify-center rounded-lg text-[9px] font-black text-indigo-750">C</span>
                    <span>API Scopes</span>
                  </div>
                  <p className="font-extrabold text-indigo-700 text-[10px] font-mono break-all bg-indigo-50/50 p-1 rounded">.../auth/drive</p>
                  <p className="text-[10px] text-slate-450 leading-relaxed font-medium">
                    {isFr 
                      ? "Faites figurer 'Google Drive API' (champs sensibles) pour activer la sauvegarde de sauvegarde et la création des dossiers locaux." 
                      : "Required to allow the school portal to read, write, and safely execute school transaction archives in custom directories."
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guide Footer / External Link */}
      <div className="bg-slate-50 border-t border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs font-bold text-slate-550">
        <span className="flex items-center gap-1.5 text-indigo-700">
          <ShieldCheck className="h-4.5 w-4.5 text-indigo-650" />
          {isFr ? "Méthode officielle et sécurisée par Google" : "Official secure setup provided by Google Cloud"}
        </span>
        <a
          href="https://console.cloud.google.com/apis/credentials/consent"
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-3xs cursor-pointer transition select-none inline-flex items-center justify-center gap-1.5"
        >
          <span>{isFr ? "Accéder à la Console Google Cloud" : "Open Google Cloud Console"}</span>
          <ExternalLink className="h-3 w-3.5" />
        </a>
      </div>
    </div>
  );
}
