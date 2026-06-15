import React, { useRef, useState } from 'react';
import { Database, Download, Upload, Trash2, CheckCircle2, RotateCcw, AlertTriangle, FileJson, Copy } from 'lucide-react';
import { ApeeParent, ApeeExpense, ApeeSettings } from '../../types';

interface ApeeArchivesProps {
  parents: ApeeParent[];
  expenses: ApeeExpense[];
  settings: ApeeSettings;
  onImportBackup: (data: { parents?: ApeeParent[]; expenses?: ApeeExpense[]; settings?: ApeeSettings }) => void;
  onResetDatabase: () => void;
  onPurgeFullDatabase?: () => Promise<void>;
}

export default function ApeeArchives({ parents, expenses, settings, onImportBackup, onResetDatabase, onPurgeFullDatabase }: ApeeArchivesProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copyCodeMsg, setCopyCodeMsg] = useState<boolean>(false);

  // Download entire dataset backup JSON file
  const handleDownloadBackup = () => {
    const backupObj = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      settings,
      parents,
      expenses,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `sauvegarde_APEE_CES_Ekali_1_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setSuccessMsg('Fichier de sauvegarde téléchargé avec succès ! Gardez-le en lieu sûr.');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Trigger file-browsing dialog
  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Read JSON file import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Basic validations
        if (!parsed.parents || !Array.isArray(parsed.parents)) {
          alert("Format invalide. Le fichier doit contenir un tableau de 'parents'.");
          return;
        }

        onImportBackup({
          parents: parsed.parents,
          expenses: parsed.expenses || [],
          settings: parsed.settings || settings,
        });

        setSuccessMsg('Restauration effectuée avec succès ! Les données cloud et locales ont été écrasées.');
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err) {
        alert("Erreur de décodage JSON : Le fichier est corrompu ou mal formé.");
      }
    };
    reader.readAsText(file);
  };

  // Seeding 4 beautifully designed Cameroonian parents with multi-pupils
  const handleSeedMockData = () => {
    if (confirm("Voulez-vous injecter un jeu d'élèves et parents d'essai camerounais ? Les données actuelles de cotisations seront remplacées.")) {
      const mockParents: ApeeParent[] = [
        {
          id: 'par_mock_1',
          name: 'M. NKOLO Jean-Pierre',
          phone: '+237 677 82 12 04',
          address: 'Ekali 1, Entrée chefferie',
          students: [
            { name: 'NKOLO Jean-Junior', classRoom: '6ème' },
            { name: 'NKOLO Marc-Aurèle', classRoom: '4ème ALL' }
          ],
          totalDue: 50000,
          totalPaid: 50000,
          status: 'soldé',
          note: 'A soldé la totalité à l\'inscription. Merci pour sa ponctualité.',
          payments: [
            { id: 'pay_mock_1a', amount: 30000, date: '2025-09-05', note: 'Acompte inscription', method: 'Orange Money' },
            { id: 'pay_mock_1b', amount: 20000, date: '2025-10-10', note: 'Solde trim 1', method: 'MTN Mobile Money' }
          ],
          createdAt: '2025-09-05T08:30:00Z',
          updatedAt: '2025-10-10T14:20:00Z'
        },
        {
          id: 'par_mock_2',
          name: 'Mme NGO BINDJEME Marie-Noëlle',
          phone: '+237 699 44 87 12',
          address: 'Mfou Centre, Carrefour TBI',
          students: [
            { name: 'BINDJEME Chantal', classRoom: '5ème' }
          ],
          totalDue: 25000,
          totalPaid: 15000,
          status: 'partiel',
          note: 'S\'engage à solder le reste de 10 000 FCFA lors du versement du salaire de décembre.',
          payments: [
            { id: 'pay_mock_2a', amount: 15000, date: '2025-09-12', note: 'Acompte rentrée', method: 'Orange Money' }
          ],
          createdAt: '2025-09-12T09:45:00Z',
          updatedAt: '2025-09-12T09:45:00Z'
        },
        {
          id: 'par_mock_3',
          name: 'M. ESSOMBA Luc-Joseph',
          phone: '+237 655 11 02 99',
          address: 'Ekali 1, carrefour antenne Orange',
          students: [
            { name: 'ESSOMBA Atangana Jean', classRoom: '3ème ESP' },
            { name: 'ESSOMBA Marie-Louise', classRoom: 'Tle' },
            { name: 'ESSOMBA Pierre', classRoom: '1ère' }
          ],
          totalDue: 75000,
          totalPaid: 25000,
          status: 'partiel',
          note: 'Famille nombreuse. Acompte de 25 000 FCFA versé. Délai COGE accordé de 2 mois.',
          payments: [
            { id: 'pay_mock_3a', amount: 25000, date: '2025-09-20', note: 'Acompte de confiance', method: 'Espèces' }
          ],
          createdAt: '2025-09-20T11:00:00Z',
          updatedAt: '2025-09-20T11:00:00Z'
        },
        {
          id: 'par_mock_4',
          name: 'Mme ABOULA Célestine',
          phone: '+237 681 05 33 41',
          address: 'Ekali 1, à côté de la pompe à eau',
          students: [
            { name: 'ABOULA André', classRoom: '2nde' }
          ],
          totalDue: 25000,
          totalPaid: 0,
          status: 'retard',
          note: 'Pas encore de versement. Promis pour fin novembre.',
          payments: [],
          createdAt: '2025-09-25T14:10:00Z',
          updatedAt: '2025-09-25T14:10:00Z'
        }
      ];

      const mockExpenses: ApeeExpense[] = [
        {
          id: 'exp_mock_1',
          type: 'command',
          title: 'Achat de 10 cartons de craies et 5 effaceurs',
          amount: 22000,
          status: 'Executed',
          date: '2025-09-08',
          description: 'Facture N°083, papeterie de Mfou.'
        },
        {
          id: 'exp_mock_2',
          type: 'payment-order',
          title: 'Paiement du vacataire de physique - Mensualité Octobre',
          amount: 60000,
          status: 'Executed',
          date: '2025-10-31',
          description: 'Ordre de Décaissement signé par le COGE et Proviseur.'
        }
      ];

      onImportBackup({
        parents: mockParents,
        expenses: mockExpenses,
        settings: {
          associationName: "APEE CES d'Ekali 1 - MFOU",
          schoolYear: '2025/2026',
          cotisationAmount: 25000,
          financialGoal: 5000000,
        }
      });

      setSuccessMsg('Données de démo camerounaises injectées ! Explorez librement les filtres.');
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleResetClick = () => {
    if (confirm("Êtes-vous ABSOLUMENT sûr de vouloir désarchiver et réinitialiser l'ensemble des données ? Vous allez vider vos cotisations, vos élèves et vos fiches de caisse du cloud et du cache local!")) {
      onResetDatabase();
      setSuccessMsg('Base de données effacée. Prête pour une nouvelle session !');
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleCopyRawBackupText = () => {
    const backupObj = {
      settings,
      parents,
      expenses,
    };
    navigator.clipboard.writeText(JSON.stringify(backupObj, null, 2)).then(() => {
      setCopyCodeMsg(true);
      setTimeout(() => setCopyCodeMsg(false), 2500);
    });
  };

  return (
    <div id="content_apee_archives" className="space-y-6">

      <div className="border-b border-slate-150 pb-4">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">📁 Archives & Sauvegardes de Données</h2>
        <p className="text-xs text-gray-500 font-medium">
          Importer et importer des fichiers JSON complets. Utile pour consolider hors ligne et conserver des archives historiques.
        </p>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        
        {/* Left Card: Import / Export */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide border-b pb-2">
            <FileJson className="h-4.5 w-4.5 text-indigo-500 hover:scale-110 active:scale-95 duration-100 transition" /> Exportation & Importation JSON
          </h3>

          <p className="text-xs text-gray-500 leading-relaxed">
            Télécharger une copie intégrale sous format JSON ouvert et standard. Vous pouvez ré-importer ce fichier à tout moment pour restaurer votre application dans le même état.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleDownloadBackup}
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-850 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Download className="h-4 w-4 text-amber-400" /> Télécharger Sauvegarde
            </button>

            <button
              onClick={handleTriggerUpload}
              className="flex-1 px-4 py-2.5 bg-slate-105 hover:bg-slate-150 border border-slate-250 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Upload className="h-4 w-4 text-indigo-500" /> Charger un Fichier
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>

          <div className="text-center pt-2">
            <button
              onClick={handleCopyRawBackupText}
              className="text-[10px] text-gray-500 hover:text-indigo-600 font-bold inline-flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 cursor-pointer select-none transition"
            >
              <Copy className="h-3 w-3" />
              {copyCodeMsg ? 'Sauvegarde Copiée dans le Presse-papier !' : 'Copier le JSON brut de sauvegarde'}
            </button>
          </div>
        </div>

        {/* Right Card: Seeding / Resetting */}
        <div className="bg-slate-50 border border-slate-150 p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-200 pb-2">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-500 animate-pulse" /> Maintenance de la Base de Données
          </h3>

          <p className="text-xs text-gray-500 leading-relaxed">
            Pour tester de façon fluide et réaliste sans entrer manuellement des dizaines d'inscriptions, vous pouvez injecter nos fiches d'exemples camerounaises pré-configurées.
          </p>

          <button
            onClick={handleSeedMockData}
            className="w-full px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-850 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition select-none"
          >
            <Database className="h-4 w-4 text-indigo-600" /> Injecter Données de Démonstration APEE
          </button>

          <hr className="border-slate-200 my-4" />

          <p className="text-[10px] text-red-700 font-bold select-none leading-relaxed">
            ⚠ ZONE DE DANGER : L'action de réinitialisation effacera instantanément l'intégralité de vos cotisations répertoriées ainsi que vos fiches de caisse du cloud (Firestore) et locaux.
          </p>

          <button
            onClick={handleResetClick}
            className="w-full px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition select-none"
          >
            <Trash2 className="h-4 w-4 text-red-600 animate-bounce" /> Vider la Base de Données APEE
          </button>
        </div>

      </div>

      {onPurgeFullDatabase && (
        <div className="bg-rose-50/50 border border-rose-150 p-6 rounded-2xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl border border-rose-200 shrink-0">
              <AlertTriangle className="h-6 w-6 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-rose-950 uppercase tracking-wider">
                🚨 ZONE ROUGE CRITIQUE : PURGE EXTRÊME DE LA BASE DE DONNÉES (USINE)
              </h3>
              <p className="text-xs text-rose-850 leading-relaxed font-semibold">
                Cette option supprime absolument TOUTES les fiches de l'établissement liées à votre compte : fiches d'élèves, relevés de notes complets, absences, devoirs, rendez-vous, messages, annonces, et TOUTES les cotisations administratives d'APEE.
              </p>
              <p className="text-[10px] text-rose-600 font-bold">
                Idéal pour supprimer les simulations pré-chargées et recommencer à insérer vos données réelles manuellement depuis le début.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                onPurgeFullDatabase();
              }}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-250 hover:shadow-lg transition duration-200"
            >
              <Trash2 className="h-4.5 w-4.5 shrink-0" />
              <span>Effacer l'intégralité du système & recommencer à zéro</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
