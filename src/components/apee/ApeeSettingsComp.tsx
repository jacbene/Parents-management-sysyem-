import React, { useState } from 'react';
import { Save, HelpCircle, Shield, Settings, Info, CheckCircle2, Plus, Trash2, Edit2, X, TrendingUp, Lock, Unlock, UserCheck, User, Phone, Mail, GraduationCap, AlertTriangle } from 'lucide-react';
import { ApeeSettings, ApeeBudgetLine, ApeeParent } from '../../types';

interface ApeeSettingsProps {
  settings: ApeeSettings;
  onSaveSettings: (settings: ApeeSettings) => Promise<boolean> | void;
  parents?: ApeeParent[];
}

export default function ApeeSettingsComp({ settings, onSaveSettings, parents = [] }: ApeeSettingsProps) {
  const [associationName, setAssociationName] = useState(settings.associationName || '');
  const [schoolYear, setSchoolYear] = useState(settings.schoolYear || '');
  const [cotisationAmount, setCotisationAmount] = useState<number>(settings.cotisationAmount || 0);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [expectedStudents, setExpectedStudents] = useState<number>(settings.expectedStudents || 100);
  const [honoraryContributions, setHonoraryContributions] = useState<number>(settings.honoraryContributions || 0);
  const [subventionsAndAids, setSubventionsAndAids] = useState<number>(settings.subventionsAndAids || 0);
  const [actualHonoraryContributions, setActualHonoraryContributions] = useState<number>(settings.actualHonoraryContributions || 0);
  const [actualSubventionsAndAids, setActualSubventionsAndAids] = useState<number>(settings.actualSubventionsAndAids || 0);

  // Dynamic calculations according to client instructions:
  // Budget prévisionnel total (objectif) = cotisations des parents + contributions des membres d'honneur + subventions et autres aides.
  const parentCotisations = expectedStudents * cotisationAmount;

  const calculatedFinancialGoal = parentCotisations + honoraryContributions + subventionsAndAids;

  // Financial Manager credentials states
  const [finManagerName, setFinManagerName] = useState(settings.finManagerName || '');
  const [finManagerPhone, setFinManagerPhone] = useState(settings.finManagerPhone || '');
  const [finManagerPassword, setFinManagerPassword] = useState(settings.finManagerPassword || '');
  const [showPassword, setShowPassword] = useState(false);

  // Pedagogical Manager credentials states
  const [pedManagerName, setPedManagerName] = useState(settings.pedManagerName || '');
  const [pedManagerPhone, setPedManagerPhone] = useState(settings.pedManagerPhone || '');
  const [pedManagerPassword, setPedManagerPassword] = useState(settings.pedManagerPassword || '');
  const [showPedPassword, setShowPedPassword] = useState(false);

  // Principal Administrators states
  const [directorName, setDirectorName] = useState(settings.directorName || '');
  const [directorPhone, setDirectorPhone] = useState(settings.directorPhone || '');
  const [directorEmail, setDirectorEmail] = useState(settings.directorEmail || '');

  const [surveillantName, setSurveillantName] = useState(settings.surveillantName || '');
  const [surveillantPhone, setSurveillantPhone] = useState(settings.surveillantPhone || '');

  const [censeurName, setCenseurName] = useState(settings.censeurName || '');
  const [censeurPhone, setCenseurPhone] = useState(settings.censeurPhone || '');

  // Class Teachers (teachers mapping list)
  const [classTeachers, setClassTeachers] = useState(() => {
    const defaultClassrooms = [
      { classRoom: '6ème', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: '5ème', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: '4ème ALL', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: '4ème ESP', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: '3ème ALL', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: '3ème ESP', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: '2nde', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: '1ère', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: 'Tle', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: 'CM2-A', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: 'CE2-B', teacherName: '', teacherPhone: '', teacherEmail: '' },
      { classRoom: 'CM1-A', teacherName: '', teacherPhone: '', teacherEmail: '' },
    ];
    const saved = settings.classTeachers || [];
    const savedMapped = saved.map(s => ({
      classRoom: s.classRoom,
      teacherName: s.teacherName || '',
      teacherPhone: s.teacherPhone || '',
      teacherEmail: s.teacherEmail || '',
    }));
    const missingPredefined = defaultClassrooms.filter(d => !saved.some(s => s.classRoom === d.classRoom));
    return [...savedMapped, ...missingPredefined];
  });

  // Synchronize local states with settings props when they load/change
  React.useEffect(() => {
    if (settings) {
      setAssociationName(settings.associationName || '');
      setSchoolYear(settings.schoolYear || '');
      setCotisationAmount(settings.cotisationAmount || 0);
      setLogoUrl(settings.logoUrl || '');
      setExpectedStudents(settings.expectedStudents || 100);
      setHonoraryContributions(settings.honoraryContributions || 0);
      setSubventionsAndAids(settings.subventionsAndAids || 0);
      setActualHonoraryContributions(settings.actualHonoraryContributions || 0);
      setActualSubventionsAndAids(settings.actualSubventionsAndAids || 0);
      setFinManagerName(settings.finManagerName || '');
      setFinManagerPhone(settings.finManagerPhone || '');
      setFinManagerPassword(settings.finManagerPassword || '');
      setPedManagerName(settings.pedManagerName || '');
      setPedManagerPhone(settings.pedManagerPhone || '');
      setPedManagerPassword(settings.pedManagerPassword || '');
      setDirectorName(settings.directorName || '');
      setDirectorPhone(settings.directorPhone || '');
      setDirectorEmail(settings.directorEmail || '');
      setSurveillantName(settings.surveillantName || '');
      setSurveillantPhone(settings.surveillantPhone || '');
      setCenseurName(settings.censeurName || '');
      setCenseurPhone(settings.censeurPhone || '');
      if (settings.classTeachers && settings.classTeachers.length > 0) {
        const defaultClassrooms = [
          { classRoom: '6ème', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: '5ème', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: '4ème ALL', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: '4ème ESP', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: '3ème ALL', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: '3ème ESP', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: '2nde', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: '1ère', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: 'Tle', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: 'CM2-A', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: 'CE2-B', teacherName: '', teacherPhone: '', teacherEmail: '' },
          { classRoom: 'CM1-A', teacherName: '', teacherPhone: '', teacherEmail: '' },
        ];
        const savedMapped = settings.classTeachers.map(s => ({
          classRoom: s.classRoom,
          teacherName: s.teacherName || '',
          teacherPhone: s.teacherPhone || '',
          teacherEmail: s.teacherEmail || '',
        }));
        const missingPredefined = defaultClassrooms.filter(d => !settings.classTeachers!.some(s => s.classRoom === d.classRoom));
        setClassTeachers([...savedMapped, ...missingPredefined]);
      }
    }
  }, [settings]);

  // Budget lines states
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineName, setLineName] = useState('');
  const [lineAmount, setLineAmount] = useState<number>(0);
  const [lineDescription, setLineDescription] = useState('');
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // Deletion confirmation state
  const [lineToDelete, setLineToDelete] = useState<{ id: string; name: string } | null>(null);
  const [classToDeleteIdx, setClassToDeleteIdx] = useState<number | null>(null);
  const [classToDeleteRoom, setClassToDeleteRoom] = useState<string>('');

  // Success indicators
  const [newClassName, setNewClassName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Paramètres enregistrés avec succès !');

  const handleSaveWithExtra = async (extra: Partial<ApeeSettings> = {}, successMsg = "Paramètres enregistrés avec succès !") => {
    try {
      const result = await onSaveSettings({
        associationName: (associationName || '').trim(),
        schoolYear: (schoolYear || '').trim(),
        cotisationAmount: cotisationAmount || 0,
        financialGoal: calculatedFinancialGoal,
        budgetLines: settings.budgetLines || [],
        finManagerName: (finManagerName || '').trim(),
        finManagerPhone: (finManagerPhone || '').trim(),
        finManagerPassword: (finManagerPassword || '').trim(),
        pedManagerName: (pedManagerName || '').trim(),
        pedManagerPhone: (pedManagerPhone || '').trim(),
        pedManagerPassword: (pedManagerPassword || '').trim(),
        logoUrl: logoUrl || '',
        directorName: (directorName || '').trim(),
        directorPhone: (directorPhone || '').trim(),
        directorEmail: (directorEmail || '').trim(),
        surveillantName: (surveillantName || '').trim(),
        surveillantPhone: (surveillantPhone || '').trim(),
        censeurName: (censeurName || '').trim(),
        censeurPhone: (censeurPhone || '').trim(),
        classTeachers: classTeachers || [],
        honoraryContributions: honoraryContributions || 0,
        subventionsAndAids: subventionsAndAids || 0,
        actualHonoraryContributions: actualHonoraryContributions || 0,
        actualSubventionsAndAids: actualSubventionsAndAids || 0,
        expectedStudents: expectedStudents || 100,
        ...extra
      });

      if (result !== false) {
        setSuccessMessage(successMsg);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
        }, 3500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(associationName || '').trim() || !(schoolYear || '').trim() || cotisationAmount <= 0 || calculatedFinancialGoal <= 0) {
      alert("Veuillez renseigner correctement l'ensemble des champs obligatoires.");
      return;
    }

    handleSaveWithExtra({}, "Paramètres généraux d'administration sauvegardés avec succès !");
  };

  const handleSaveBudgetLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineName.trim() || lineAmount <= 0) {
      alert("Veuillez saisir un libellé valide et un montant alloué supérieur à 0.");
      return;
    }

    const currentLines = settings.budgetLines || [];
    let updatedLines = [...currentLines];

    if (editingLineId) {
      updatedLines = updatedLines.map(l => 
        l.id === editingLineId 
          ? { id: l.id, name: lineName.trim(), allocatedAmount: lineAmount, description: lineDescription.trim() || undefined }
          : l
      );
      setSuccessMessage("Ligne budgétaire modifiée avec succès.");
    } else {
      const newLine: ApeeBudgetLine = {
        id: 'bl_' + Date.now(),
        name: lineName.trim(),
        allocatedAmount: lineAmount,
        description: lineDescription.trim() || undefined
      };
      updatedLines.push(newLine);
      setSuccessMessage("Nouvelle ligne budgétaire enregistrée.");
    }

    handleSaveWithExtra({ budgetLines: updatedLines });

    // Reset budget form and close modal
    setEditingLineId(null);
    setLineName('');
    setLineAmount(0);
    setLineDescription('');
    setIsBudgetModalOpen(false);

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3500);
  };

  const handleStartEditLine = (line: ApeeBudgetLine) => {
    setEditingLineId(line.id);
    setLineName(line.name);
    setLineAmount(line.allocatedAmount);
    setLineDescription(line.description || '');
    setIsBudgetModalOpen(true);
  };

  const handleCancelEditLine = () => {
    setEditingLineId(null);
    setLineName('');
    setLineAmount(0);
    setLineDescription('');
    setIsBudgetModalOpen(false);
  };

  const handleDeleteLine = (id: string, name: string) => {
    setLineToDelete({ id, name });
  };

  const handleConfirmDeleteLine = () => {
    if (!lineToDelete) return;
    const { id } = lineToDelete;
    const currentLines = settings.budgetLines || [];
    const updatedLines = currentLines.filter(l => l.id !== id);

    handleSaveWithExtra({ budgetLines: updatedLines });

    setSuccessMessage("Ligne budgétaire supprimée de la planification annuelle.");
    setShowSuccess(true);
    setLineToDelete(null);
    setTimeout(() => setShowSuccess(false), 3500);
  };

  const handleConfirmDeleteClass = () => {
    if (classToDeleteIdx === null) return;
    setClassTeachers(classTeachers.filter((_, idxFilter) => idxFilter !== classToDeleteIdx));
    setClassToDeleteIdx(null);
    setClassToDeleteRoom('');
  };

  // Calculations for budget consumption status
  const budgetLinesList = settings.budgetLines || [];
  const totalAllocated = budgetLinesList.reduce((acc, curr) => acc + curr.allocatedAmount, 0);
  const percentAllocated = Math.min(100, Math.round((totalAllocated / calculatedFinancialGoal) * 100)) || 0;

  return (
    <div id="content_apee_settings" className="space-y-6">

      <div className="border-b border-slate-150 pb-4">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">⚙️ Configuration des Paramètres & Budget</h2>
        <p className="text-xs text-gray-500 font-medium">
          Ajuster les tarifs unitaires exigibles par élève, définir l'enveloppe annuelle et structurer la planification des lignes budgétaires.
        </p>
      </div>

      {showSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-semibold animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: main config form */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white border border-slate-150 rounded-2xl p-4 md:p-5 space-y-4">
          <div className="border-b pb-2 text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide border-slate-100 select-none">
            <Settings className="h-4 w-4 text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} /> Configuration Administrative et Tarifaire
          </div>

          <div className="space-y-4">
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase">Nom Officiel de l'Association <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={associationName}
                onChange={(e) => setAssociationName(e.target.value)}
                placeholder="Ex: APEE CES d'Ekali 1 - MFOU"
                className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-505 font-medium"
              />
            </div>

            {/* Logo de l'établissement */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-600 uppercase block">Logo de l'Établissement (Visuel En-tête)</label>
              <div className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="h-14 w-14 bg-white rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0 overflow-hidden relative shadow-3xs text-center">
                  {logoUrl ? (
                    <>
                      <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-0.5" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="absolute top-0 right-0 p-0.5 bg-red-150 hover:bg-red-250 text-red-700 rounded-bl-lg cursor-pointer transition shadow-4xs"
                        title="Supprimer le logo"
                      >
                        <X className="h-2.5 w-2.5 shrink-0" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[8px] font-extrabold uppercase text-slate-400">Aucun</span>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="relative overflow-hidden inline-block bg-white hover:bg-slate-50 transition border border-slate-350 px-3 py-1 rounded-lg text-[10px] font-black text-slate-800 cursor-pointer">
                    Télécharger une image...
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 1 * 1024 * 1024) {
                            alert("🔴 Image trop volumineuse. Veuillez choisir un fichier de moins de 1 Mo.");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setLogoUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium">Se synchronise instantanément avec la barre d'en-tête globale.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Année Scolaire Active <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  placeholder="Ex: 2025/2026"
                  className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-550 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Taux Par Élève Camerounais (FCFA) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="500"
                  required
                  value={cotisationAmount || ''}
                  onChange={(e) => setCotisationAmount(Number(e.target.value))}
                  placeholder="Ex: 12500"
                  className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-550 font-mono text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Nombre d'Élèves Attendus <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  required
                  value={expectedStudents || ''}
                  onChange={(e) => setExpectedStudents(Number(e.target.value))}
                  placeholder="Ex: 100"
                  className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-550 font-mono text-right"
                />
              </div>

            </div>

            {/* SECTION: Calculated Annual Budget Goal Breakdowns */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4.5 space-y-3 shadow-3xs">
              <span className="text-[10px] text-indigo-950 font-extrabold uppercase tracking-wider block">
                📐 Synthèse & Total du Budget Prévisionnel (Objectif)
              </span>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-white/70 px-3 py-2 rounded-xl border border-indigo-100/40">
                  <span className="text-slate-600 font-bold">1. Cotisations des parents (attendues) :</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-800block">{parentCotisations.toLocaleString()} FCFA</span>
                    <span className="text-[9px] text-slate-500 block">({expectedStudents} élèves attendus × {cotisationAmount.toLocaleString()} F)</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-white/70 px-3 py-2 rounded-xl border border-indigo-100/40">
                  <span className="text-slate-600 font-bold">2. Contributions des membres d'honneur :</span>
                  <span className="font-mono font-bold text-slate-800">{honoraryContributions.toLocaleString()} FCFA</span>
                </div>
                
                <div className="flex justify-between items-center bg-white/70 px-3 py-2 rounded-xl border border-indigo-100/40">
                  <span className="text-slate-600 font-bold">3. Subventions & autres aides (A.D.S) :</span>
                  <span className="font-mono font-bold text-slate-800">{subventionsAndAids.toLocaleString()} FCFA</span>
                </div>
                
                <div className="border-t border-indigo-200/60 my-2 pt-2 flex justify-between items-center">
                  <span className="text-indigo-950 font-black uppercase text-[10px]">Total du Budget Prévisionnel :</span>
                  <span className="font-mono font-black text-sm text-indigo-700">{calculatedFinancialGoal.toLocaleString()} FCFA</span>
                </div>
              </div>
              <p className="text-[8.5px] text-indigo-700/80 leading-normal font-medium">
                * Note : Ce montant prévisionnel total sert de base de calcul pour les jauges de recouvrement, les statistiques et le découpage de vos lignes d'allocations de dépenses. Le budget est équilibré en recettes et en dépenses à {calculatedFinancialGoal.toLocaleString()} FCFA.
              </p>
            </div>

            {/* Other Revenue streams */}
            <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
              <div className="flex items-center gap-2 select-none">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">1. Autres Sources de Recettes (Prévues/Budget)</span>
                <span className="h-px bg-slate-100 flex-1" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Contributions Membres d'Honneur (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    value={honoraryContributions || ''}
                    onChange={(e) => setHonoraryContributions(Number(e.target.value))}
                    placeholder="Ex: 500000"
                    className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-550 font-mono text-right"
                  />
                  <p className="text-[8.5px] text-gray-400 leading-tight">Contributions financières prévues pour les parents d'honneur et conseillers.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Aides, Dons et Subventions (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    value={subventionsAndAids || ''}
                    onChange={(e) => setSubventionsAndAids(Number(e.target.value))}
                    placeholder="Ex: 1000000"
                    className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-550 font-mono text-right"
                  />
                  <p className="text-[8.5px] text-gray-400 leading-tight">Subventions ministérielles ou dons de municipalités prévus.</p>
                </div>

              </div>
            </div>

          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 bg-slate-900 border border-slate-800 hover:border-black hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
          >
            <Save className="h-4 w-4 text-emerald-400" /> Enregistrer les Configurations
          </button>
        </form>

        {/* Right column: help notes & Financial Manager Profile */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 space-y-4 ">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide border-b pb-2">
              <Info className="h-4 w-4 text-sky-500" /> Planification Budgétaire
            </h3>

            <div className="text-xs text-gray-500 space-y-3 leading-relaxed font-normal">
              <p>
                Les cotisations scolaires APEE sont capitalisées à hauteur de la prévision globale. Il est conseillé de répartir cet objectif en **lignes budgétaires** strictes pour chaque type de dépenses (Didactique, Réparations, Fonctionnement COGE).
              </p>
              <p>
                En liant chaque dépense saisie sous <strong>Régie Financière</strong> à sa ligne budgétaire associée, le système calcule automatiquement les <strong>taux de consommation budgétaire</strong> en temps réel.
              </p>
              <hr className="border-slate-200" />
              <div className="bg-sky-50 text-sky-900 p-3 rounded-lg flex gap-2 items-start text-[10px]">
                <Shield className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
                <div>
                  <strong>Allocation d'Enveloppe :</strong>
                  <p className="mt-1">Veillez à ce que la somme des montants alloués ne dépasse pas l'objectif budgétaire prévisionnel pour conserver l'équilibre financier de l'école.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-150 rounded-2xl p-4.5 space-y-4 shadow-3xs">
            <h3 className="text-xs font-bold text-slate-850 flex items-center gap-1.5 uppercase tracking-wide border-b pb-2 select-none">
              <Shield className="h-4 w-4 text-indigo-500" /> Responsable Financier & Restreindre
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Nom Complet <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400">👤</span>
                  <input
                    type="text"
                    required
                    value={finManagerName}
                    onChange={(e) => setFinManagerName(e.target.value)}
                    placeholder="Ex: M. Jean-Pierre Atangana"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Téléphone <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400">📞</span>
                  <input
                    type="text"
                    required
                    value={finManagerPhone}
                    onChange={(e) => setFinManagerPhone(e.target.value)}
                    placeholder="Ex: +237 6xx xx xx xx"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-indigo-500 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Mot de passe de contrôle <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400">🔑</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={finManagerPassword}
                    onChange={(e) => setFinManagerPassword(e.target.value)}
                    placeholder="Saisir un mot de passe vigile"
                    className="w-full pl-8 pr-12 py-1.5 text-xs bg-slate-50 border border-slate-250 rounded-lg focus:outline-indigo-500 font-mono text-slate-800 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1.5 text-[9px] text-gray-500 hover:text-indigo-650 cursor-pointer p-0.5 font-bold uppercase"
                  >
                    {showPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
              </div>

              {/* Status Indicator */}
              <div className={`p-3 rounded-xl flex gap-2.5 items-start text-[10px] border leading-normal ${
                finManagerPassword ? 'bg-emerald-50 text-emerald-950 border-emerald-250' : 'bg-amber-50 text-amber-950 border-amber-250'
              }`}>
                {finManagerPassword ? (
                  <>
                    <Lock className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div>
                      <strong>Contrôle d'accès actif (Verrouillé)</strong>
                      <p className="mt-1 font-normal text-slate-600">
                        La création ou suppression des parents, reçus et dépenses exigera le mot de passe de {finManagerName || "M. le Responsable"}.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong>Sécurité désactivée</strong>
                      <p className="mt-1 font-normal text-slate-600">
                        Aucun vigile configuré. N'importe quel utilisateur connecté peut librement ajouter et supprimer des données dans l'espace APEE.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!finManagerName.trim() || !finManagerPhone.trim() || !finManagerPassword.trim()) {
                    alert("Veuillez renseigner tous les champs du Responsable Financier (Nom, Téléphone et Mot de passe).");
                    return;
                  }
                  handleSaveWithExtra({
                    finManagerName: finManagerName.trim(),
                    finManagerPhone: finManagerPhone.trim(),
                    finManagerPassword: finManagerPassword.trim(),
                  }, "Accès du Responsable Financier enregistrés avec succès !");
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer transition shadow-2xs"
              >
                <UserCheck className="h-4 w-4" /> Sauvegarder les accès
              </button>
            </div>
          </div>

          {/* Pedagogical Manager Profile */}
          <div className="bg-white border border-slate-150 rounded-2xl p-4.5 space-y-4 shadow-3xs">
            <h3 className="text-xs font-bold text-slate-850 flex items-center gap-1.5 uppercase tracking-wide border-b pb-2 select-none">
              <Shield className="h-4 w-4 text-emerald-500" /> Responsable Pédagogique & Administratif
            </h3>

            <div className="space-y-3.5 text-xs">
              <p className="text-[10px] text-slate-500 leading-normal">
                Configurez l'autorité pédagogique officielle (Censeur ou Surveillant Général) seule habilitée à introduire et modifier les informations de scolarité (bulletins, notes, assiduité, devoirs et communiqués).
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Nom Complet (Censeur / SG) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400">👤</span>
                  <input
                    type="text"
                    required
                    value={pedManagerName}
                    onChange={(e) => setPedManagerName(e.target.value)}
                    placeholder="Ex: M. François Bidzogo (Censeur)"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-emerald-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Téléphone <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400">📞</span>
                  <input
                    type="text"
                    required
                    value={pedManagerPhone}
                    onChange={(e) => setPedManagerPhone(e.target.value)}
                    placeholder="Ex: +237 6xx xx xx xx"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-emerald-500 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Mot de Passe Vigile <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400">🔑</span>
                  <input
                    type={showPedPassword ? "text" : "password"}
                    required
                    value={pedManagerPassword}
                    onChange={(e) => setPedManagerPassword(e.target.value)}
                    placeholder="Mot de passe d'administration académique"
                    className="w-full pl-8 pr-12 py-1.5 text-xs bg-slate-50 border border-slate-250 rounded-lg focus:outline-emerald-500 font-mono text-slate-800 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPedPassword(!showPedPassword)}
                    className="absolute right-2.5 top-1.5 text-[9px] text-gray-500 hover:text-emerald-650 cursor-pointer p-0.5 font-bold uppercase select-none"
                  >
                    {showPedPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
              </div>

              {/* Status Indicator */}
              <div className={`p-3 rounded-xl flex gap-2.5 items-start text-[10px] border leading-normal ${
                pedManagerPassword ? 'bg-emerald-50 text-emerald-950 border-emerald-250' : 'bg-amber-50 text-amber-950 border-amber-250'
              }`}>
                {pedManagerPassword ? (
                  <>
                    <Lock className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div>
                      <strong>Contrôle académique strict activé</strong>
                      <p className="mt-1 font-normal text-slate-600">
                        La modification des notes, devoirs, fiches d'assiduité et publication d'actualités exige le mot de passe de {pedManagerName || "l'autorité pédagogique"}.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong>Accès libre (Saisie non sécurisée)</strong>
                      <p className="mt-1 font-normal text-slate-600">
                        Aucun responsable académique enregistré. N'importe quel visiteur connecté de l'ENT peut introduire et réinitialiser les données scolaires.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!pedManagerName.trim() || !pedManagerPhone.trim() || !pedManagerPassword.trim()) {
                    alert("Veuillez renseigner tous les champs du Responsable Pédagogique (Nom, Téléphone et Mot de passe).");
                    return;
                  }
                  handleSaveWithExtra({
                    pedManagerName: pedManagerName.trim(),
                    pedManagerPhone: pedManagerPhone.trim(),
                    pedManagerPassword: pedManagerPassword.trim(),
                  }, "Accès du Responsable Pédagogique enregistrés avec succès !");
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer transition shadow-2xs"
              >
                <UserCheck className="h-4 w-4" /> Sauvegarder les accès scolaires
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* SECTION: School Administrators and Class Titular Teachers */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Card 1: Principal Administrators */}
        <div className="xl:col-span-5 bg-white border border-slate-150 rounded-2xl p-4 md:p-5 space-y-4 shadow-3xs">
          <div className="border-b pb-2 select-none">
            <h3 className="text-xs font-bold text-slate-850 flex items-center gap-1.5 uppercase tracking-wide">
              <GraduationCap className="h-4 w-4 text-indigo-500" /> Responsibles d'Établissement
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Saisir les contacts officiels de l'administration scolaire.</p>
          </div>

          <div className="space-y-4.5 text-xs">
            {/* Directeur */}
            <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-2.5">
              <span className="font-bold text-slate-800 text-[11px] block">Directorat (Le Directeur)</span>
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-550 uppercase">Nom complet du Directeur</label>
                  <div className="relative mt-0.5">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-white"
                      placeholder="Nom et prénoms du Directeur"
                      value={directorName}
                      onChange={(e) => setDirectorName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-550 uppercase">Téléphone</label>
                    <div className="relative mt-0.5">
                      <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-white"
                        placeholder="Ex: +237 6xx..."
                        value={directorPhone}
                        onChange={(e) => setDirectorPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-550 uppercase">Email / Contact</label>
                    <div className="relative mt-0.5">
                      <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-white"
                        placeholder="Ex: secretariat@ecole..."
                        value={directorEmail}
                        onChange={(e) => setDirectorEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Surveillant Général */}
            <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-2.5">
              <span className="font-bold text-slate-800 text-[11px] block">Surveillance Générale (Le Surveillant)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-550 uppercase">Nom du Surveillant</label>
                  <div className="relative mt-0.5">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-white"
                      placeholder="Nom complet"
                      value={surveillantName}
                      onChange={(e) => setSurveillantName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-550 uppercase">Téléphone</label>
                  <div className="relative mt-0.5">
                    <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-white"
                      placeholder="Numéro de téléphone"
                      value={surveillantPhone}
                      onChange={(e) => setSurveillantPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Censeur */}
            <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-2.5">
              <span className="font-bold text-slate-800 text-[11px] block">Censeur Principal (L'Inspecteur/Censeur)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-550 uppercase">Nom du Censeur</label>
                  <div className="relative mt-0.5">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-white"
                      placeholder="Nom complet"
                      value={censeurName}
                      onChange={(e) => setCenseurName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-550 uppercase">Téléphone</label>
                  <div className="relative mt-0.5">
                    <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-white"
                      placeholder="Numéro de téléphone"
                      value={censeurPhone}
                      onChange={(e) => setCenseurPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                handleSaveWithExtra({
                  directorName: directorName.trim(),
                  directorPhone: directorPhone.trim(),
                  directorEmail: directorEmail.trim(),
                  surveillantName: surveillantName.trim(),
                  surveillantPhone: surveillantPhone.trim(),
                  censeurName: censeurName.trim(),
                  censeurPhone: censeurPhone.trim(),
                }, "Responsables administratifs enregistrés avec succès !");
              }}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs mt-2"
            >
              <Save className="h-4 w-4" /> Enregistrer les Responsables
            </button>
          </div>
        </div>

        {/* Card 2: Per-Class Titular Teachers */}
        <div className="xl:col-span-7 bg-white border border-slate-150 rounded-2xl p-4 md:p-5 space-y-4 shadow-3xs">
          <div className="border-b pb-2 select-none flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-slate-850 flex items-center gap-1.5 uppercase tracking-wide">
                <UserCheck className="h-4 w-4 text-emerald-500" /> Professeurs Titulaires par Classe
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Associer chaque niveau de classe à un enseignant titulaire attitré.</p>
            </div>
            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
              {classTeachers.length} classes configurées
            </span>
          </div>

          <div className="space-y-4">
            {/* Scrollable teachers inputs list */}
            <div className="max-h-[380px] overflow-y-auto pr-2 divide-y divide-slate-100 space-y-4">
              {classTeachers.map((teach, idx) => (
                <div key={idx} className="pt-4 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-black bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-lg">
                        {teach.classRoom}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 italic">Enseignant Titulaire</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setClassToDeleteIdx(idx);
                        setClassToDeleteRoom(teach.classRoom);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition cursor-pointer"
                      title={`Supprimer la classe ${teach.classRoom}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Nom complet</label>
                      <input
                        type="text"
                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 mt-0.5"
                        placeholder="Ex: M. Jean Picard"
                        value={teach.teacherName}
                        onChange={(e) => {
                          const updated = classTeachers.map((t, i) =>
                            i === idx ? { ...t, teacherName: e.target.value } : t
                          );
                          setClassTeachers(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Téléphone</label>
                      <input
                        type="text"
                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 mt-0.5"
                        placeholder="Ex: +237 6xx..."
                        value={teach.teacherPhone || ''}
                        onChange={(e) => {
                          const updated = classTeachers.map((t, i) =>
                            i === idx ? { ...t, teacherPhone: e.target.value } : t
                          );
                          setClassTeachers(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Email / Contact</label>
                      <input
                        type="text"
                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 mt-0.5 text-slate-650"
                        placeholder="Ex: jean.picard@ecole..."
                        value={teach.teacherEmail || ''}
                        onChange={(e) => {
                          const updated = classTeachers.map((t, i) =>
                            i === idx ? { ...t, teacherEmail: e.target.value } : t
                          );
                          setClassTeachers(updated);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Form to add a new classroom division */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-[9px] font-bold text-slate-600 uppercase">Ajouter une classe sur-mesure</label>
                <input
                  type="text"
                  placeholder="Ex: 6ème A, 4ème ALL 2, CM2..."
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!newClassName.trim()) {
                    alert("Le nom de la classe ne peut pas être vide.");
                    return;
                  }
                  if (classTeachers.some(t => t.classRoom.trim().toLowerCase() === newClassName.trim().toLowerCase())) {
                    alert("Cette classe existe déjà dans la liste.");
                    return;
                  }
                  setClassTeachers([
                    ...classTeachers,
                    { classRoom: newClassName.trim(), teacherName: '', teacherPhone: '', teacherEmail: '' }
                  ]);
                  setNewClassName('');
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                handleSaveWithExtra({
                  classTeachers: classTeachers,
                }, "Liste des professeurs titulaires mise à jour !");
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs mt-2"
            >
              <Save className="h-4 w-4" /> Mettre à jour les Professeurs
            </button>
          </div>
        </div>
      </div>

      {/* NEW SECTION: Annual Budget Lines Allocation */}
      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 space-y-6">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-indigo-500" /> Répartition du Budget Annuel de l'Établissement
            </h3>
            <p className="text-[10px] text-gray-400">Définissez les enveloppes allouées par rubrique de dépenses pour l'exercice {schoolYear}.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-right">
              <div className="text-[9px] font-bold text-slate-500">Allocation Budgétaire Totale</div>
              <div className="font-mono text-xs font-black text-slate-800">
                {totalAllocated.toLocaleString()} FCFA <span className="text-[10px] font-medium text-gray-400">/ {calculatedFinancialGoal.toLocaleString()} FCFA</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingLineId(null);
                setLineName('');
                setLineAmount(0);
                setLineDescription('');
                setIsBudgetModalOpen(true);
              }}
              className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-3xs hover:shadow-2xs"
            >
              <Plus className="h-4 w-4" /> Ajouter une Rubrique
            </button>
          </div>
        </div>

        {/* Visual progress allocated */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-semibold">
            <span className="text-slate-600">Pourcentage alloué de l'enveloppe globale</span>
            <span className={percentAllocated > 100 ? "text-rose-600" : "text-indigo-600"}>{percentAllocated}% alloués</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                percentAllocated > 100 ? "bg-rose-500" : percentAllocated === 100 ? "bg-emerald-500" : "bg-indigo-500"
              }`}
              style={{ width: `${percentAllocated}%` }}
            />
          </div>
        </div>

        {/* List of budget lines */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 px-1 border-l-2 border-indigo-500 select-none">
            Rubriques Enregistrées ({budgetLinesList.length})
          </h4>

          {budgetLinesList.length === 0 ? (
            <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl p-8 text-center text-xs text-slate-400">
              Aucune rubrique budgétaire n'est enregistrée pour cette année académique. 
              Cliquez sur le bouton "Ajouter une Rubrique" ci-dessus pour découper l'objectif global en centres de dépenses.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {budgetLinesList.map((line) => {
                const percentOfTotal = Math.round((line.allocatedAmount / calculatedFinancialGoal) * 100) || 0;
                return (
                  <div 
                    key={line.id} 
                    className={`border p-4 rounded-xl space-y-3 transition-all duration-200 flex flex-col justify-between ${
                      editingLineId === line.id 
                        ? 'border-indigo-500 bg-indigo-50/20 shadow-xs' 
                        : 'border-slate-150 bg-white hover:border-slate-350 hover:shadow-2xs'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <h5 className="text-xs font-bold text-slate-850 line-clamp-1">{line.name}</h5>
                        <span className="text-[9px] font-sans font-extrabold bg-slate-100 text-slate-705 px-1.5 rounded shrink-0">
                          {percentOfTotal}% du budget
                        </span>
                      </div>
                      {line.description ? (
                        <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed min-h-[32px]">
                          {line.description}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-300 italic min-h-[32px]">
                          Aucune description fournie
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-50 pt-2 shrink-0">
                      <div className="font-mono text-xs font-black text-indigo-650">
                        {line.allocatedAmount.toLocaleString()} FCFA
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEditLine(line)}
                          title="Modifier cette rubrique"
                          className="p-1 px-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLine(line.id, line.name)}
                          title="Supprimer cette rubrique"
                          className="p-1 px-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Define / Edit Budget Line */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="budget_line_modal">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden animate-scale-in">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {editingLineId ? <Edit2 className="h-4 w-4 text-indigo-500" /> : <Plus className="h-4 w-4 text-indigo-500" />}
                {editingLineId ? 'Modifier la Ligne Budgétaire' : 'Nouvelle Ligne Budgétaire'}
              </h3>
              <button
                type="button"
                onClick={handleCancelEditLine}
                className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg text-xs font-bold font-mono transition cursor-pointer"
              >
                X
              </button>
            </div>

            <form onSubmit={handleSaveBudgetLine} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-655 uppercase block">Nom de la Ligne Budgétaire <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={lineName}
                  onChange={(e) => setLineName(e.target.value)}
                  placeholder="Ex: Didactique et Craies"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500 font-medium text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-655 uppercase block">Montant Alloué (FCFA) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 text-[10px] top-2.5 font-bold text-slate-450">FCFA</span>
                  <input
                    type="number"
                    min="1000"
                    required
                    value={lineAmount || ''}
                    onChange={(e) => setLineAmount(Number(e.target.value))}
                    placeholder="Ex: 500000"
                    className="w-full pl-14 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500 font-mono text-slate-800 text-right font-bold bg-slate-50/20"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-650 uppercase block">Description / Détails d'usage</label>
                <textarea
                  value={lineDescription}
                  onChange={(e) => setLineDescription(e.target.value)}
                  placeholder="Ex: Achat de rames de papier, agendas pédagogiques, stylos pour enseignants..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-indigo-500 font-medium text-slate-800 resize-none animate-none"
                />
              </div>

              <div className="flex gap-2 p-3 mt-4 border-t border-slate-100 shrink-0">
                {editingLineId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingLineId) {
                        handleDeleteLine(editingLineId, lineName);
                        setIsBudgetModalOpen(false);
                      }
                    }}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition uppercase tracking-wide cursor-pointer text-center flex items-center justify-center gap-1.5 shrink-0"
                    title="Supprimer cette rubrique budgétaire"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600 shrink-0" /> Supprimer
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancelEditLine}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition uppercase tracking-wide cursor-pointer text-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition uppercase tracking-wide cursor-pointer text-center"
                >
                  {editingLineId ? 'Sauvegarder' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Budget Line */}
      {lineToDelete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] no-print animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in duration-200">
            {/* Header warning zone */}
            <div className="bg-red-50 p-6 flex flex-col items-center gap-3 text-center border-b border-red-100 shrink-0">
              <div className="p-3 bg-red-100 text-red-655 rounded-full animate-pulse">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900 tracking-tight">Supprimer la Rubrique</h3>
              </div>
            </div>
            
            {/* Body details info */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 text-center sm:text-left">
              <p className="text-sm text-slate-655 leading-relaxed mb-4">
                Voulez-vous vraiment supprimer définitivement cette rubrique budgétaire ?
              </p>
              
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 mb-4 text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase select-none">Rubrique</div>
                <div className="text-sm font-bold text-slate-800 tracking-tight mt-0.5">{lineToDelete.name}</div>
              </div>

              <div className="text-xs text-slate-655 flex items-start gap-2 bg-amber-50 text-amber-850 p-3.5 rounded-xl border border-amber-200 text-left">
                <span className="shrink-0 mt-0.5 font-bold">⚠️ Important:</span>
                <span>Les dépenses et les écritures comptables déjà exécutées sous cette rubrique perdront leur étiquette d'imputation budgétaire (affectation au budget).</span>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setLineToDelete(null)}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-705 bg-white border border-slate-250 hover:bg-slate-50 rounded-xl cursor-pointer transition select-none"
              >
                Conserver la rubrique
              </button>
              
              <button
                type="button"
                onClick={handleConfirmDeleteLine}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer transition select-none flex items-center justify-center gap-1.5 shadow-xs min-w-[130px]"
              >
                <Trash2 className="h-3.5 w-3.5 text-white shrink-0" />
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Classroom configuration */}
      {classToDeleteIdx !== null && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] no-print animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in duration-200">
            {/* Header warning zone */}
            <div className="bg-red-50 p-6 flex flex-col items-center gap-3 text-center border-b border-red-100 shrink-0">
              <div className="p-3 bg-red-100 text-red-655 rounded-full animate-bounce">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900 tracking-tight">Supprimer la Configuration</h3>
              </div>
            </div>
            
            {/* Body details info */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 text-center sm:text-left">
              <p className="text-sm text-slate-655 leading-relaxed mb-4">
                Voulez-vous vraiment supprimer la configuration de l'enseignant titulaire pour cette classe ?
              </p>
              
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 mb-4 text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase select-none">Classe</div>
                <div className="text-sm font-bold text-slate-800 tracking-tight mt-0.5">{classToDeleteRoom}</div>
              </div>

              <div className="text-xs text-slate-655 flex items-start gap-2 bg-slate-50 text-slate-705 p-3.5 rounded-xl border border-slate-200 text-left">
                <span className="shrink-0 mt-0.5 font-bold">💡 Information:</span>
                <span>Cette action va réinitialiser le nom, le téléphone et l'e-mail de l'enseignant de cette division. Aucun bulletin existant ne sera détruit. Pratique pour repartir à zéro.</span>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setClassToDeleteIdx(null);
                  setClassToDeleteRoom('');
                }}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-705 bg-white border border-slate-250 hover:bg-slate-50 rounded-xl cursor-pointer transition select-none"
              >
                Conserver la classe
              </button>
              
              <button
                type="button"
                onClick={handleConfirmDeleteClass}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer transition select-none flex items-center justify-center gap-1.5 shadow-xs min-w-[130px]"
              >
                <Trash2 className="h-3.5 w-3.5 text-white shrink-0" />
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
