import React, { useState, useEffect } from 'react';
import { useLanguage } from '../utils/TranslationContext';
import { 
  googleAccessToken, 
  loginWithGoogle, 
  setGoogleAccessToken 
} from '../firebase';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Download, 
  UploadCloud, 
  Plus, 
  HelpCircle, 
  LogOut, 
  Layers, 
  ExternalLink,
  ChevronRight,
  Info,
  Database,
  ArrowRight
} from 'lucide-react';
import { ApeeParent, Invoice, Student } from '../types';

interface SheetsPortalProps {
  parents: ApeeParent[];
  invoices: Invoice[];
  students: Student[];
  onSaveParent: (parent: ApeeParent) => Promise<boolean>;
}

interface GoogleSpreadsheetItem {
  id: string;
  name: string;
  webViewLink?: string;
  createdTime?: string;
}

export default function SheetsPortal({ parents, invoices, students, onSaveParent }: SheetsPortalProps) {
  const { language, t } = useLanguage();
  const [token, setToken] = useState<string | null>(googleAccessToken);
  const [isLoading, setIsLoading] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<GoogleSpreadsheetItem[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>('');
  const [customSpreadsheetId, setCustomSpreadsheetId] = useState<string>('');
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');
  
  // Statuses
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  
  // Create spreadsheet states
  const [newSheetTitle, setNewSheetTitle] = useState('Pasma-sys School Portal Registry');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  // Import Preview states
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [importTargetType, setImportTargetType] = useState<'parents' | 'students'>('parents');
  const [isReadingSheet, setIsReadingSheet] = useState(false);
  const [showImportConfirmation, setShowImportConfirmation] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // Sync token state with Firebase token
  useEffect(() => {
    setToken(googleAccessToken);
  }, [googleAccessToken]);

  // Load sheets on token change
  useEffect(() => {
    if (token) {
      loadUserSpreadsheets();
    }
  }, [token]);

  // Get selected ID (prioritize dropdown over custom input unless custom is filled)
  const getSpreadsheetId = () => {
    return customSpreadsheetId.trim() || selectedSpreadsheetId;
  };

  // Google OAuth Log In
  const handleConnect = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
      setToken(googleAccessToken);
    } catch (err: any) {
      console.error('Failed to authenticate Google Sheets scopes:', err);
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

  // Google Log Out
  const handleDisconnect = () => {
    setGoogleAccessToken(null);
    setToken(null);
    setSpreadsheets([]);
    setSheetTabs([]);
    setSelectedSpreadsheetId('');
    setCustomSpreadsheetId('');
  };

  // List all Google Sheets files from Drive
  const loadUserSpreadsheets = async () => {
    if (!googleAccessToken) return;
    setIsLoading(true);
    try {
      const query = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink,createdTime)&orderBy=createdTime desc`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          handleDisconnect();
          throw new Error("Google access expired. Please log in again.");
        }
        throw new Error("Error retrieving spreadsheets from Drive.");
      }

      const data = await res.json();
      const files: GoogleSpreadsheetItem[] = data.files || [];
      setSpreadsheets(files);
      if (files.length > 0 && !selectedSpreadsheetId) {
        setSelectedSpreadsheetId(files[0].id);
        fetchSpreadsheetTabs(files[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Sheets / Tabs within the chosen spreadsheet
  const fetchSpreadsheetTabs = async (spreadsheetId: string) => {
    if (!googleAccessToken || !spreadsheetId) return;
    setIsLoading(true);
    setSheetTabs([]);
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        const tabs = (data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
        setSheetTabs(tabs);
        if (tabs.length > 0) {
          setSelectedTab(tabs[0]);
        }
      } else {
        console.warn("Failed to retrieve spreadsheet tabs structure.");
      }
    } catch (err) {
      console.error("Error listing spreadsheet sheets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Spreadsheet Selection Change
  const handleSpreadsheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedSpreadsheetId(id);
    if (id) {
      fetchSpreadsheetTabs(id);
    } else {
      setSheetTabs([]);
    }
  };

  // Create a brand new Google Sheets Spreadsheet with pre-configured schemas
  const handleCreateSpreadsheet = async () => {
    const activeToken = googleAccessToken || token;
    if (!activeToken) return;
    setIsCreatingSheet(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const payload = {
        properties: {
          title: `${newSheetTitle} - ${new Date().toISOString().split('T')[0]}`
        },
        sheets: [
          { properties: { title: "APEE Parents & Finance" } },
          { properties: { title: "Students Register" } },
          { properties: { title: "Invoices & Billing" } }
        ]
      };

      const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(language === 'en' ? "Unable to provision spreadsheet." : "Impossible de créer la feuille de calcul.");
      }

      const data = await res.json();
      if (data.spreadsheetId) {
        setSelectedSpreadsheetId(data.spreadsheetId);
        setCustomSpreadsheetId('');
        setActionSuccessMsg(
          language === 'en'
            ? `New spreadsheet successfully created! ID: ${data.spreadsheetId}`
            : `Nouvelle feuille de calcul créée avec succès ! ID : ${data.spreadsheetId}`
        );
        loadUserSpreadsheets();
        fetchSpreadsheetTabs(data.spreadsheetId);
      }
    } catch (err: any) {
      console.error(err);
      setActionErrorMsg(err.message);
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Push values into Google Sheets (Export helper)
  const writeValuesToSheet = async (spreadsheetId: string, range: string, values: any[][]) => {
    const activeToken = googleAccessToken || token;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    
    // Clear old contents first to avoid leaving residue of longer old sheets
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeToken}`
      }
    });

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${activeToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Sheets API error: ${res.statusText} (${errText})`);
    }
  };

  // Export Pasma datasets to Google Sheets
  const handleExportToSheets = async (target: 'parents' | 'students' | 'invoices' | 'all') => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      alert(language === 'en' ? "Please select or input a Google Spreadsheet." : "Veuillez choisir ou saisir une feuille de calcul Google.");
      return;
    }

    const confirmExport = window.confirm(
      language === 'en'
        ? `Are you sure you want to write this data to Google Sheets? This will overwrite existing data on the corresponding tabs.`
        : `Êtes-vous sûr de vouloir écrire ces données dans Google Sheets ? Cela écrasera les données existantes sur les onglets correspondants.`
    );
    if (!confirmExport) return;

    setIsExporting(target);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      // 1. Export APEE Parents & Financials
      if (target === 'parents' || target === 'all') {
        const parentsData = [
          [
            "ID Parent", "Nom Complet", "Téléphone", "E-mail", "Statut Cotisation", 
            "Cotisation Annuelle Exigible (FCFA)", "Total Versé (FCFA)", 
            "Reste à Payer (FCFA)", "Dernier Rappel Envoyé", "Élèves Associés"
          ]
        ];

        parents.forEach(p => {
          const kids = (p.students || []).map(s => `${s.name} (${s.classRoom})`).join(', ');
          parentsData.push([
            p.id,
            p.name,
            p.phone || '',
            p.email || '',
            p.status,
            p.totalDue.toString(),
            p.totalPaid.toString(),
            (p.totalDue - p.totalPaid).toString(),
            p.lastReminded || 'Aucun',
            kids
          ]);
        });

        await writeValuesToSheet(spreadsheetId, "APEE Parents & Finance!A1:J2000", parentsData);
      }

      // 2. Export Students Academic register
      if (target === 'students' || target === 'all') {
        const studentsData = [
          ["ID Élève", "Nom Complet", "Classe", "Salle", "Date de Naissance", "Enseignant Titulaire", "E-mail Enseignant"]
        ];

        students.forEach(s => {
          studentsData.push([
            s.id,
            s.name,
            s.grade,
            s.classRoom || s.grade,
            s.dob || '2017-06-15',
            s.teacherName || '',
            s.teacherEmail || ''
          ]);
        });

        await writeValuesToSheet(spreadsheetId, "Students Register!A1:G3000", studentsData);
      }

      // 3. Export Invoices and Billing statements
      if (target === 'invoices' || target === 'all') {
        const invoicesData = [
          ["ID Facture", "ID Élève", "Intitulé de Cotisation", "Montant Total (FCFA)", "Statut", "Échéance", "Méthode de Paiement"]
        ];

        invoices.forEach(inv => {
          invoicesData.push([
            inv.id,
            inv.studentId,
            inv.title,
            inv.amount.toString(),
            inv.status,
            inv.dueDate,
            inv.provider || 'Espèces'
          ]);
        });

        await writeValuesToSheet(spreadsheetId, "Invoices & Billing!A1:G4000", invoicesData);
      }

      setActionSuccessMsg(
        language === 'en'
          ? "Successfully exported selected data tables to Google Sheets!"
          : "Données exportées avec succès vers Google Sheets !"
      );
      
      // Auto-refresh tabs list
      fetchSpreadsheetTabs(spreadsheetId);
    } catch (err: any) {
      console.error(err);
      setActionErrorMsg(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  // Read Values from Spreadsheet (Import Preview Helper)
  const handlePreviewSheet = async () => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      alert(language === 'en' ? "Please select a Google Spreadsheet." : "Veuillez choisir une feuille de calcul Google.");
      return;
    }
    if (!selectedTab) {
      alert(language === 'en' ? "Please select a sheet tab." : "Veuillez choisir un onglet.");
      return;
    }

    setIsReadingSheet(true);
    setPreviewRows([]);
    setPreviewColumns([]);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      // Read a generous block of cells (A1:K1000)
      const range = `${selectedTab}!A1:K1000`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${googleAccessToken || token}`
        }
      });

      if (!res.ok) {
        throw new Error(language === 'en' ? "Failed to read cell values. Make sure the tab name exists." : "Impossible de lire l'onglet choisi.");
      }

      const data = await res.json();
      const rawRows: any[][] = data.values || [];
      if (rawRows.length === 0) {
        throw new Error(language === 'en' ? "The selected sheet tab is empty." : "L'onglet sélectionné est vide.");
      }

      // First row contains the column header names
      const headers = rawRows[0];
      setPreviewColumns(headers);

      // Remaining rows represent data records
      const records = rawRows.slice(1).map((row, index) => {
        const item: any = { _rowNum: index + 2 };
        headers.forEach((header, colIdx) => {
          item[header] = row[colIdx] !== undefined ? row[colIdx].toString().trim() : '';
        });
        return item;
      });

      setPreviewRows(records);

      // Deduce target import mode based on sheet tab title keywords
      const tabLower = (selectedTab || '').toLowerCase();
      if (tabLower.includes('parent') || tabLower.includes('apee') || tabLower.includes('finance')) {
        setImportTargetType('parents');
      } else if (tabLower.includes('student') || tabLower.includes('élève') || tabLower.includes('classe') || tabLower.includes('register')) {
        setImportTargetType('students');
      }

      setActionSuccessMsg(
        language === 'en'
          ? `Successfully retrieved ${records.length} data rows from tab "${selectedTab}"!`
          : `Récupération réussie de ${records.length} lignes depuis l'onglet "${selectedTab}" !`
      );
    } catch (err: any) {
      console.error(err);
      setActionErrorMsg(err.message);
    } finally {
      setIsReadingSheet(false);
    }
  };

  // Fetch values and trigger the import confirmation immediately
  const handleDirectImport = async () => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      alert(language === 'en' ? "Please select a Google Spreadsheet." : "Veuillez choisir une feuille de calcul Google.");
      return;
    }
    if (!selectedTab) {
      alert(language === 'en' ? "Please select a sheet tab." : "Veuillez choisir un onglet.");
      return;
    }

    setIsReadingSheet(true);
    setPreviewRows([]);
    setPreviewColumns([]);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const range = `${selectedTab}!A1:K1000`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${googleAccessToken || token}`
        }
      });

      if (!res.ok) {
        throw new Error(language === 'en' ? "Failed to read cell values. Make sure the tab name exists." : "Impossible de lire l'onglet choisi.");
      }

      const data = await res.json();
      const rawRows: any[][] = data.values || [];
      if (rawRows.length === 0) {
        throw new Error(language === 'en' ? "The selected sheet tab is empty." : "L'onglet sélectionné est vide.");
      }

      const headers = rawRows[0];
      setPreviewColumns(headers);

      const records = rawRows.slice(1).map((row, index) => {
        const item: any = { _rowNum: index + 2 };
        headers.forEach((header, colIdx) => {
          item[header] = row[colIdx] !== undefined ? row[colIdx].toString().trim() : '';
        });
        return item;
      });

      setPreviewRows(records);

      const tabLower = (selectedTab || '').toLowerCase();
      if (tabLower.includes('parent') || tabLower.includes('apee') || tabLower.includes('finance')) {
        setImportTargetType('parents');
      } else if (tabLower.includes('student') || tabLower.includes('élève') || tabLower.includes('classe') || tabLower.includes('register')) {
        setImportTargetType('students');
      }

      // Open confirmation modal directly
      setShowImportConfirmation(true);
    } catch (err: any) {
      console.error(err);
      setActionErrorMsg(err.message);
    } finally {
      setIsReadingSheet(false);
    }
  };

  // Perform bulk import into Firestore database after explicit confirmation dialog
  const handleExecuteImport = async () => {
    setShowImportConfirmation(false);
    setIsImporting(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    let successCount = 0;
    let failureCount = 0;

    try {
      if (importTargetType === 'parents') {
        // Expected Columns in Template:
        // [ID Parent, Nom Complet, Téléphone, E-mail, Statut Cotisation, Cotisation Annuelle Exigible (FCFA), Total Versé (FCFA), Reste à Payer (FCFA), Dernier Rappel Envoyé, Élèves Associés]
        // Also supports clean standard layouts
        for (const row of previewRows) {
          const parentName = row["Nom Complet"] || row["Parent Name"] || row["Name"] || row["Nom"];
          if (!parentName) {
            failureCount++;
            continue; // Skip invalid records
          }

          const parentId = row["ID Parent"] || row["ID"] || `par_sheets_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const phone = row["Téléphone"] || row["Phone"] || row["Tel"] || '';
          const email = row["E-mail"] || row["Email"] || '';
          const status = row["Statut Cotisation"] || row["Status"] || row["Statut"] || 'retard';
          const totalDue = parseInt(row["Cotisation Annuelle Exigible (FCFA)"] || row["Total Due"] || row["Exigible"] || '50000', 10) || 50000;
          const totalPaid = parseInt(row["Total Versé (FCFA)"] || row["Total Paid"] || row["Versé"] || '0', 10) || 0;
          const lastReminded = row["Dernier Rappel Envoyé"] || row["Last Reminded"] || '';
          
          // Parse child students
          let parsedStudents: any[] = [];
          const kidsStr = row["Élèves Associés"] || row["Students"] || row["Enfants"] || '';
          if (kidsStr) {
            // Format example: "Abel Bene (CM2), Chantal Bene (CE1)"
            parsedStudents = kidsStr.split(',').map((k: string) => {
              const cleaned = k.trim();
              const match = cleaned.match(/^([^(]+)(?:\(([^)]+)\))?/);
              if (match) {
                return {
                  name: match[1].trim(),
                  classRoom: match[2] ? match[2].trim() : 'CM2'
                };
              }
              return { name: cleaned, classRoom: 'CM2' };
            });
          }

          const rawStatus = (status || 'retard').toString().toLowerCase();
          const mappedStatus: 'soldé' | 'partiel' | 'retard' = 
            (rawStatus === 'regle' || rawStatus === 'soldé' || rawStatus === 'paid') ? 'soldé' :
            (rawStatus === 'partiel' || rawStatus === 'partial') ? 'partiel' : 'retard';

          const importedParentObj: ApeeParent = {
            id: parentId,
            name: parentName,
            phone,
            email,
            status: mappedStatus,
            address: row["Adresse"] || row["Address"] || '',
            totalDue,
            totalPaid,
            lastReminded,
            students: parsedStudents,
            note: row["Remarques"] || row["Note"] || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            payments: totalPaid > 0 ? [{
              id: `pay_imported_${parentId}`,
              amount: totalPaid,
              date: new Date().toISOString().split('T')[0],
              method: 'Espèces',
              transactionId: 'IMPORTED_SHEETS',
              note: 'Versement importé de Google Sheets'
            }] : []
          };

          const success = await onSaveParent(importedParentObj);
          if (success) successCount++;
          else failureCount++;
        }
      } else {
        // Students register import mode
        // ID Élève, Nom Complet, Classe, Salle, Date de Naissance, Enseignant Titulaire, E-mail Enseignant
        for (const row of previewRows) {
          const studentName = row["Nom Complet"] || row["Student Name"] || row["Name"] || row["Nom"];
          if (!studentName) {
            failureCount++;
            continue;
          }

          // Create matching parent if not exists, or link to generic portal
          const sId = row["ID Élève"] || row["ID"] || `stu_sheets_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const grade = row["Classe"] || row["Grade"] || 'CM2';
          const classRoom = row["Salle"] || row["Classroom"] || grade;
          const dob = row["Date de Naissance"] || row["DOB"] || row["Birthday"] || '2017-06-15';
          const teacherName = row["Enseignant Titulaire"] || row["Teacher"] || 'Mme Sophie Laurent';
          const teacherEmail = row["E-mail Enseignant"] || row["Teacher Email"] || 'sophie.laurent@pasma.sys';

          // Construct a virtual parent so standard database trigger linkages couple perfectly
          const importedParentObj: ApeeParent = {
            id: `par_generic_${sId}`,
            name: `Parent de ${studentName}`,
            phone: '',
            email: '',
            status: 'retard',
            address: '',
            totalDue: 50000,
            totalPaid: 0,
            students: [{ name: studentName, classRoom: classRoom, dob: dob }],
            note: '',
            payments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          const success = await onSaveParent(importedParentObj);
          if (success) successCount++;
          else failureCount++;
        }
      }

      setActionSuccessMsg(
        language === 'en'
          ? `Import completed! Successfully loaded and synchronized ${successCount} database records.`
          : `Importer avec succès ! Synchronisation réussie de ${successCount} fiches (Fiches ignorées/erronées : ${failureCount}).`
      );
      setPreviewRows([]);
    } catch (err: any) {
      console.error("Sheets import execution failed:", err);
      setActionErrorMsg(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans leading-relaxed" id="pasma-google-sheets-portal">
      {/* Banner / Header */}
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 border-b border-slate-800 py-8 px-6 text-white text-left relative overflow-hidden shadow-md">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(20,184,166,0.15),transparent_60%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 rounded-full text-[9px] font-black tracking-widest bg-teal-500/10 text-teal-300 border border-teal-500/20 uppercase">
                {language === 'en' ? "Spreadsheet Sync" : "Sincérité Excel"}
              </span>
              <div className="flex items-center gap-1 text-[8.5px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-3xs">
                <FileSpreadsheet className="h-3 w-3 shrink-0 text-teal-400" />
                <span>Google Sheets v4 API</span>
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
              {language === 'en' ? "Google Sheets Core Portal" : "Portail d'Intégration Google Sheets"}
            </h1>
            <p className="text-xs text-slate-400 leading-normal font-medium">
              {language === 'en' 
                ? "Seamlessly export school portal data, generate pre-structured templates, or import parents and student rosters back from your spreadsheets."
                : "Exportez les données du portail, générez des modèles de feuilles de calcul, ou importez en masse des listes de parents d'élèves directement."}
            </p>
          </div>
          
          {/* Action Header bar */}
          <div className="flex items-center gap-3 shrink-0">
            {token && (
              <button
                type="button"
                onClick={() => setShowHelpGuide(!showHelpGuide)}
                className={`text-[10.5px] font-extrabold px-3.5 py-2.5 rounded-2xl border transition uppercase tracking-wider cursor-pointer flex items-center gap-2 select-none h-[3.2rem] ${
                  showHelpGuide 
                    ? 'bg-teal-650 hover:bg-teal-700 text-white border-teal-700 shadow-sm' 
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700/50 shadow-3xs'
                }`}
              >
                <HelpCircle className="h-4 w-4 shrink-0 text-teal-400" />
                <span>{language === 'en' ? 'Templates Guide' : 'Guide Modèles'}</span>
              </button>
            )}
            
            {token ? (
              <div className="flex items-center gap-2.5 bg-slate-850 border border-slate-700/60 p-2 pl-3 rounded-2xl shadow-xs" style={{ height: '3.2rem' }}>
                <div className="relative">
                  <div className="h-4.5 w-4.5 absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-white block animate-pulse" />
                  </div>
                  <div className="h-10 w-10 rounded-full bg-teal-600 flex items-center justify-center font-black text-xs text-white uppercase shadow-sm">
                    GS
                  </div>
                </div>
                <div className="text-left pr-2">
                  <p className="text-xs font-black text-slate-200">{language === 'en' ? "Sheets Active" : "Sheets Connecté"}</p>
                  <button 
                    onClick={handleDisconnect}
                    className="text-[9px] font-bold text-slate-400 hover:text-red-400 transition flex items-center gap-1 cursor-pointer mt-0.5 uppercase tracking-wider"
                  >
                    <LogOut className="h-2.5 w-2.5" />
                    {language === 'en' ? "Disconnect" : "Déconnecter"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="gsi-material-button text-xs py-2 px-4 shadow-md bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 cursor-pointer transition flex items-center gap-2"
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
                  <span className="font-extrabold text-[#1f1f1f] text-sm font-sans tracking-wide">
                    {language === 'en' ? "Activate Google Sheets" : "Activer Google Sheets"}
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Status Alerts */}
        {actionSuccessMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-3xl text-xs text-emerald-800 font-bold flex items-center gap-3 shadow-2xs text-left animate-fade-in">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            <span className="flex-1">{actionSuccessMsg}</span>
          </div>
        )}
        {actionErrorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-3xl text-xs text-red-800 font-bold flex items-center gap-3 shadow-2xs text-left animate-fade-in">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <span className="flex-1">{actionErrorMsg}</span>
          </div>
        )}

        {!token ? (
          /* Authentication Block */
          <div className="space-y-8 max-w-4xl mx-auto my-12 text-center">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 md:p-12 text-center max-w-xl mx-auto space-y-6">
              <div className="h-16 w-16 bg-teal-50 text-teal-650 rounded-full flex items-center justify-center mx-auto shadow-2xs">
                <FileSpreadsheet className="h-8 w-8 text-teal-600 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-extrabold text-slate-850">
                  {language === 'en' ? "Access Google Sheets" : "Accès à Google Sheets requis"}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  {language === 'en'
                    ? "Establish a direct secure bridge with your Google account to edit sheets and sync student roster datasets with zero friction."
                    : "Établissez une liaison sécurisée directe avec votre compte Google pour modifier des feuilles de calcul et synchroniser les données."}
                </p>
              </div>

              {authError && (
                <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs text-amber-900 space-y-3 shadow-3xs animate-fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-amber-950 mb-1">{language === 'en' ? "Pop-up Blocked" : "Fenêtres pop-up bloquées"}</h4>
                      <p className="text-[11px] text-amber-850 leading-relaxed">
                        {language === 'en'
                          ? "Since this app is executing within an AI Studio iframe, your browser automatically blocks the authorization popup window."
                          : "Comme l'application s'affiche dans un iframe d'IA Studio, le navigateur bloque automatiquement la fenêtre d'authentification."}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] text-amber-850 space-y-2 pt-2 border-t border-amber-200/55 pl-7">
                    <p className="font-semibold">{language === 'en' ? "How to resolve:" : "Comment résoudre ce problème :"}</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>{language === 'en' ? "Look at your browser's URL address bar right side." : "Regardez à droite de la barre d'adresse de votre navigateur."}</li>
                      <li>{language === 'en' ? "Click the blocked pop-up icon and select 'Always allow pop-ups from this site'." : "Cliquez sur l'icône de pop-up bloquée et sélectionnez 'Toujours autoriser'."}</li>
                      <li>{language === 'en' ? "Then click the sign-in button again to authenticate successfully." : "Cliquez à nouveau sur le bouton pour vous connecter."}</li>
                    </ul>
                  </div>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="py-3 px-6 bg-teal-650 hover:bg-teal-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition transform hover:scale-101 cursor-pointer inline-flex items-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>{isLoading ? "Connecting..." : (language === 'en' ? "Secure Google Sign-In" : "Connexion Sécurisée Google")}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Main Workspace Control Panel */
          <div className="space-y-8 animate-fade-in">
            {showHelpGuide && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs text-left space-y-5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Info className="h-5 w-5 text-teal-600" />
                    {language === 'en' ? "Google Sheets Import/Export Guidelines" : "Guide de Structuration des Données Google Sheets"}
                  </h3>
                  <button onClick={() => setShowHelpGuide(false)} className="text-xs text-slate-400 hover:text-slate-600 font-extrabold">✕ Close</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div className="space-y-3 bg-teal-50/30 p-4 border border-teal-100 rounded-2xl">
                    <h4 className="font-extrabold text-teal-950 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-teal-500" />
                      1. APEE Parents Sheet Schema
                    </h4>
                    <p className="text-slate-500 leading-relaxed">
                      {language === 'en'
                        ? "To safely import parents and their student records, prepare a sheet tab named 'APEE Parents & Finance' with these precise headers:"
                        : "Pour importer des parents d'élèves, l'onglet doit s'appeler 'APEE Parents & Finance' avec ces colonnes exactes :"}
                    </p>
                    <div className="bg-slate-900 text-teal-400 p-3 rounded-xl font-mono text-[10px] whitespace-pre overflow-x-auto">
                      ID Parent | Nom Complet | Téléphone | E-mail | Statut Cotisation | Cotisation Annuelle Exigible (FCFA) | Total Versé (FCFA) | Élèves Associés
                    </div>
                    <p className="text-[10px] text-slate-400 italic">
                      * {language === 'en' ? "Élèves Associés format: 'Kid Name (CM2), Secondary Kid (CE1)'" : "Format Élèves Associés : 'Nom Enfant (CM2), Second Enfant (CE1)'"}
                    </p>
                  </div>

                  <div className="space-y-3 bg-indigo-50/30 p-4 border border-indigo-100 rounded-2xl">
                    <h4 className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                      2. Students Register Sheet Schema
                    </h4>
                    <p className="text-slate-500 leading-relaxed">
                      {language === 'en'
                        ? "To register basic pupil rosters and class folders, format your worksheet with the following header layout:"
                        : "Pour charger simplement des listes d'élèves par classe, organisez vos colonnes ainsi :"}
                    </p>
                    <div className="bg-slate-900 text-indigo-400 p-3 rounded-xl font-mono text-[10px] whitespace-pre overflow-x-auto">
                      ID Élève | Nom Complet | Classe | Salle | Date de Naissance | Enseignant Titulaire | E-mail Enseignant
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Spreadsheet Config & Direct Exporters (Col Span 4) */}
              <div className="lg:col-span-4 space-y-6 text-left">
                
                {/* Spreadsheet Selection Widget */}
                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-teal-600" />
                      {language === 'en' ? "Active Spreadsheet" : "Liaison Fichier"}
                    </h3>
                    <button 
                      onClick={loadUserSpreadsheets}
                      className="p-1 text-slate-400 hover:text-slate-750 transition"
                      title="Refresh files"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Spreadsheets List Dropdown */}
                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-450 uppercase">{language === 'en' ? "Select from Google Drive" : "Choisir depuis Google Drive"}</label>
                      <select
                        value={selectedSpreadsheetId}
                        onChange={handleSpreadsheetChange}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="">-- {language === 'en' ? "Select a spreadsheet" : "Choisissez un fichier"} --</option>
                        {spreadsheets.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="text-center text-[10px] font-black text-slate-400 py-1 uppercase">{language === 'en' ? "OR" : "OU"}</div>

                    {/* Custom ID Input */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-450 uppercase">{language === 'en' ? "Paste Custom Spreadsheet ID" : "ID de document personnalisé"}</label>
                      <input
                        type="text"
                        placeholder="e.g. 1aBCDeFGHiJKLmNoPQ-R_StUvWx..."
                        value={customSpreadsheetId}
                        onChange={(e) => {
                          setCustomSpreadsheetId(e.target.value);
                          if (e.target.value.trim().length > 15) {
                            fetchSpreadsheetTabs(e.target.value.trim());
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {getSpreadsheetId() && (
                      <div className="bg-teal-50/40 p-3 rounded-2xl border border-teal-100/50 space-y-1">
                        <p className="font-extrabold text-teal-950 truncate">
                          {spreadsheets.find(s => s.id === selectedSpreadsheetId)?.name || (language === 'en' ? "External Document Loaded" : "Document externe chargé")}
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono truncate">{getSpreadsheetId()}</p>
                        <a 
                          href={`https://docs.google.com/spreadsheets/d/${getSpreadsheetId()}`} 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          className="text-[9.5px] font-bold text-teal-600 hover:text-teal-850 flex items-center gap-1 pt-1 underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {language === 'en' ? "Open Sheet in New Tab" : "Ouvrir le fichier Excel"}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Provision New spreadsheet */}
                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="h-4.5 w-4.5 text-teal-600" />
                      {language === 'en' ? "Create New Spreadsheet" : "Créer un nouveau fichier"}
                    </h3>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-450 uppercase">{language === 'en' ? "Workbook Title" : "Nom du classeur"}</label>
                      <input
                        type="text"
                        value={newSheetTitle}
                        onChange={(e) => setNewSheetTitle(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold"
                      />
                    </div>
                    
                    <button
                      onClick={handleCreateSpreadsheet}
                      disabled={isCreatingSheet}
                      className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                    >
                      {isCreatingSheet ? (
                        <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <FileSpreadsheet className="h-4 w-4" />
                      )}
                      <span>{language === 'en' ? "Initialize School Spreadsheet" : "Créer le Classeur Scolaire"}</span>
                    </button>
                    
                    <p className="text-[10px] text-slate-400 text-center italic">
                      {language === 'en'
                        ? "* Generates pre-formatted tabs for Parents, Students, and Invoices."
                        : "* Génère trois onglets structurés prêts pour le transfert."}
                    </p>
                  </div>
                </div>

                {/* Direct Exporter Panel */}
                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Download className="h-4.5 w-4.5 text-teal-600" />
                      {language === 'en' ? "Export Data to Sheets" : "Exporter vers Google Sheets"}
                    </h3>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Parents */}
                    <button
                      onClick={() => handleExportToSheets('parents')}
                      disabled={!!isExporting || !getSpreadsheetId()}
                      className="w-full p-2.5 bg-slate-50 border border-slate-150 hover:bg-teal-50/50 hover:border-teal-200 rounded-xl text-left font-semibold text-slate-800 transition flex items-center justify-between disabled:opacity-55 disabled:hover:bg-slate-50 cursor-pointer"
                    >
                      <div>
                        <span className="font-extrabold block text-xs">{language === 'en' ? "APEE Parents & Finance" : "Dossier Parents APEE"}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{parents.length} records</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>

                    {/* Students */}
                    <button
                      onClick={() => handleExportToSheets('students')}
                      disabled={!!isExporting || !getSpreadsheetId()}
                      className="w-full p-2.5 bg-slate-50 border border-slate-150 hover:bg-teal-50/50 hover:border-teal-200 rounded-xl text-left font-semibold text-slate-800 transition flex items-center justify-between disabled:opacity-55 disabled:hover:bg-slate-50 cursor-pointer"
                    >
                      <div>
                        <span className="font-extrabold block text-xs">{language === 'en' ? "Students Directory" : "Registre des Élèves"}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{students.length} records</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>

                    {/* Invoices */}
                    <button
                      onClick={() => handleExportToSheets('invoices')}
                      disabled={!!isExporting || !getSpreadsheetId()}
                      className="w-full p-2.5 bg-slate-50 border border-slate-150 hover:bg-teal-50/50 hover:border-teal-200 rounded-xl text-left font-semibold text-slate-800 transition flex items-center justify-between disabled:opacity-55 disabled:hover:bg-slate-50 cursor-pointer"
                    >
                      <div>
                        <span className="font-extrabold block text-xs">{language === 'en' ? "Invoices & Billings" : "Factures & Intendance"}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{invoices.length} records</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>

                    <div className="pt-2">
                      <button
                        onClick={() => handleExportToSheets('all')}
                        disabled={!!isExporting || !getSpreadsheetId()}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                      >
                        {isExporting === 'all' ? (
                          <span className="animate-spin inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <UploadCloud className="h-3.5 w-3.5" />
                        )}
                        <span>{language === 'en' ? "Sync All Registers (Full Export)" : "Tout exporter (Mise à jour globale)"}</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Sheet Importer & Live Preview Console (Col Span 8) */}
              <div className="lg:col-span-8 space-y-6 text-left">
                
                {/* Spreadsheet Import Control Panel */}
                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <UploadCloud className="h-4.5 w-4.5 text-teal-600" />
                      {language === 'en' ? "Import Data from Spreadsheet" : "Importer des fiches Google Sheets"}
                    </h3>
                  </div>

                  <p className="text-[11px] text-slate-450 leading-normal">
                    {language === 'en'
                      ? "Choose a spreadsheet, select a worksheet tab from the list below, and pull records into Pasma-sys. Verify column names before executing import."
                      : "Choisissez un classeur Google Sheets, sélectionnez l'onglet cible ci-dessous, visualisez la grille puis intégrez-la en toute sécurité."}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end text-xs">
                    {/* Choose Tab */}
                    <div className="md:col-span-6 space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">{language === 'en' ? "Select Tab / Worksheet" : "Choisir l'onglet"}</label>
                      <select
                        value={selectedTab}
                        onChange={(e) => setSelectedTab(e.target.value)}
                        disabled={sheetTabs.length === 0}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                      >
                        {sheetTabs.length === 0 ? (
                          <option value="">-- {language === 'en' ? "No tabs found" : "Aucun onglet trouvé"} --</option>
                        ) : (
                          sheetTabs.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Import Target Data Type */}
                    <div className="md:col-span-6 space-y-1">
                      <label className="text-[10px] font-black text-slate-450 uppercase">{language === 'en' ? "Sync Destination" : "Type de données"}</label>
                      <select
                        value={importTargetType}
                        onChange={(e) => setImportTargetType(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="parents">{language === 'en' ? "APEE Parents" : "Dossier Parents"}</option>
                        <option value="students">{language === 'en' ? "Students Register" : "Élèves Scolaires"}</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={handlePreviewSheet}
                      disabled={isReadingSheet || !getSpreadsheetId()}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs border border-slate-200"
                    >
                      {isReadingSheet ? (
                        <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-slate-700 border-t-transparent rounded-full" />
                      ) : (
                        <Database className="h-4 w-4" />
                      )}
                      <span>{language === 'en' ? "Preview Tab" : "Charger l'Aperçu de l'Onglet"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDirectImport}
                      disabled={isReadingSheet || !getSpreadsheetId()}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                    >
                      {isReadingSheet ? (
                        <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                      <span>{language === 'en' ? "Import Now" : "Importer les fiches"}</span>
                    </button>
                  </div>
                </div>

                {/* Preview Sheet data table console */}
                {previewRows.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black bg-indigo-50 border border-indigo-150 text-indigo-700 uppercase px-2 py-0.5 rounded-md">
                          {language === 'en' ? "Tab Preview" : "Aperçu de la Grille"}
                        </span>
                        <h4 className="text-xs font-black text-slate-800">
                          {language === 'en' ? `Target Mapping: ${importTargetType === 'parents' ? 'APEE Parents' : 'Students Register'}` : `Type d'importation déduit : ${importTargetType === 'parents' ? 'APEE Parents' : 'Registre Élèves'}`}
                        </h4>
                      </div>

                      <button
                        onClick={() => setShowImportConfirmation(true)}
                        className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition transform hover:scale-101 cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <UploadCloud className="h-4 w-4" />
                        <span>{language === 'en' ? "Import to Portal" : "Importer dans le Portail"}</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto max-h-[350px] border border-slate-150 rounded-2xl">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-450 font-black uppercase text-[9.5px]">
                            <th className="p-2 pl-3">Row</th>
                            {previewColumns.map((col, i) => (
                              <th key={i} className="p-2 truncate max-w-[150px]">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previewRows.slice(0, 15).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 font-medium">
                              <td className="p-2 pl-3 font-mono text-slate-400">#{row._rowNum}</td>
                              {previewColumns.map((col, cIdx) => (
                                <td key={cIdx} className="p-2 text-slate-700 truncate max-w-[160px]" title={row[col]}>
                                  {row[col] || <span className="text-slate-350 italic">empty</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {previewRows.length > 15 && (
                      <p className="text-[10px] text-slate-400 text-center italic">
                        {language === 'en' 
                          ? `* Showing first 15 rows of ${previewRows.length} available records total.` 
                          : `* Affichage des 15 premières lignes sur les ${previewRows.length} fiches disponibles.`}
                      </p>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Explicit MANDATORY Mutating Import Confirmation Dialog / Modal */}
      {showImportConfirmation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-150 text-left space-y-5 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-700 rounded-2xl shrink-0 shadow-3xs">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  {language === 'en' ? "Confirm Sheets Database Sync" : "Confirmer l'importation de masse"}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {language === 'en'
                    ? "You are about to modify the core school directory database. Any matching student and parent IDs will be updated and merged with your sheets spreadsheet rows."
                    : "Vous vous apprêtez à modifier la base de données de l'école. Les identifiants correspondants seront écrasés ou fusionnés avec les lignes de votre tableur."}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 space-y-2.5 text-xs">
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">{language === 'en' ? "Worksheet Tab Source" : "Onglet Source"}</span>
                <span className="text-slate-800 font-mono">"{selectedTab}"</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">{language === 'en' ? "Data Mapping Target" : "Cible de Mapping"}</span>
                <span className="text-teal-700 uppercase">{importTargetType === 'parents' ? 'APEE Parents' : 'Students Register'}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t border-slate-200">
                <span className="text-slate-500">{language === 'en' ? "Total Records to Process" : "Fiches à charger"}</span>
                <span className="text-slate-900 text-sm font-black font-mono">{previewRows.length} rows</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImportConfirmation(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-150 text-slate-700 font-black text-xs rounded-xl transition cursor-pointer select-none text-center"
              >
                {language === 'en' ? "Cancel & Abort" : "Annuler & Abandonner"}
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={isImporting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition cursor-pointer select-none text-center shadow-md flex items-center justify-center gap-1.5"
              >
                {isImporting ? (
                  <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <span>{language === 'en' ? "Confirm & Sync" : "Confirmer l'importation"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline guide component for GCP configuration assistance
function GcpConsentGuide({ language }: { language: 'fr' | 'en' }) {
  return (
    <div className="bg-indigo-950 border border-indigo-800/80 rounded-3xl p-6 text-left text-white max-w-4xl mx-auto space-y-4 shadow-md animate-fade-in">
      <div className="flex items-center gap-2 border-b border-indigo-900 pb-3">
        <Layers className="h-5 w-5 text-teal-400" />
        <h3 className="text-sm font-black uppercase tracking-wider">
          {language === 'en' ? "Developer Credentials Consent Screen Instructions" : "Configuration de l'Écran de Consentement GCP"}
        </h3>
      </div>
      
      <p className="text-xs text-indigo-200 leading-normal">
        {language === 'en'
          ? "If your Google account displays an 'Unverified App' security warning during sign-in, this is standard behavior for development-level sandbox integrations. To resolve or bypass this, do the following:"
          : "Si votre compte Google affiche un avertissement de sécurité 'Application non vérifiée' lors de l'accès, c'est le comportement normal en mode développement. Pour le bypasser ou le configurer :"}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-indigo-300">
        <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-indigo-900/60 space-y-1.5">
          <span className="font-extrabold text-teal-400 font-mono text-xs block">STEP 1</span>
          <p className="leading-relaxed">
            {language === 'en'
              ? "On the Google Security Warning popup screen, click on 'Advanced Options' link at the bottom."
              : "Sur l'avertissement de sécurité Google, cliquez sur 'Options Avancées' en bas à gauche."}
          </p>
        </div>
        
        <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-indigo-900/60 space-y-1.5">
          <span className="font-extrabold text-teal-400 font-mono text-xs block">STEP 2</span>
          <p className="leading-relaxed">
            {language === 'en'
              ? "Click on 'Go to pasma-sys (unsafe)' links to authorize scopes and return to portal workspace safely."
              : "Cliquez sur 'Accéder à pasma-sys (non sécurisé)' pour autoriser l'accès et revenir au portail."}
          </p>
        </div>

        <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-indigo-900/60 space-y-1.5">
          <span className="font-extrabold text-teal-400 font-mono text-xs block">STEP 3</span>
          <p className="leading-relaxed">
            {language === 'en'
              ? "To verify app, open GCP Console -> OAuth Consent Screen, and move your app to Production."
              : "Pour supprimer l'alerte, allez dans la Console GCP -> Écran de consentement OAuth, et passez en production."}
          </p>
        </div>
      </div>
    </div>
  );
}
