import React, { useState } from 'react';
import { Attendance, AttendanceStatus, Student } from '../types';
import { Calendar, CheckCircle2, XCircle, AlertCircle, Clock, Plus, Trash2, Lock, Unlock, Printer, Download, Scan, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRScannerModal from './QRScannerModal';

interface AttendanceTrackerProps {
  attendanceLogs: Attendance[];
  onAddAttendance?: (log: Attendance) => Promise<boolean>;
  onDeleteAttendance?: (id: string) => Promise<boolean>;
  isPedAuthorized?: boolean;
  onPromptUnlockPed?: () => void;
  pedManagerName?: string;
  hasPedPassword?: boolean;
  activeStudent?: Student | null;
  onUpdateStudent?: (updated: Student) => Promise<boolean>;
  onPrintReport?: () => void;
  allStudents?: Student[];
}

export default function AttendanceTracker({
  attendanceLogs,
  onAddAttendance,
  onDeleteAttendance,
  isPedAuthorized = false,
  onPromptUnlockPed,
  pedManagerName = '',
  hasPedPassword = false,
  activeStudent,
  onUpdateStudent,
  onPrintReport,
  allStudents = [],
}: AttendanceTrackerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [status, setStatus] = useState<AttendanceStatus>('Absent');
  const [remarks, setRemarks] = useState('');
  const [attDate, setAttDate] = useState('');

  // Compute basic attendance statistics
  const totalDays = attendanceLogs.length;
  const presentDays = attendanceLogs.filter(a => a.status === 'Present').length;
  const lateDays = attendanceLogs.filter(a => a.status === 'Late').length;
  const excusedDays = attendanceLogs.filter(a => a.status === 'Excused').length;
  const absentDays = attendanceLogs.filter(a => a.status === 'Absent').length;

  // Calculate current consecutive absent days ending at the most recent attendance date
  const consecutiveAbsentCount = (() => {
    if (!attendanceLogs || attendanceLogs.length === 0) return 0;
    const logMap = new Map<string, Attendance>();
    attendanceLogs.forEach(l => logMap.set(l.date, l));
    const sortedDates = Array.from(logMap.keys()).sort((a, b) => a.localeCompare(b));
    let count = 0;
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const logItem = logMap.get(sortedDates[i]);
      if (logItem && logItem.status === 'Absent') {
        count++;
      } else {
        break;
      }
    }
    return count;
  })();

  const attendanceRate = totalDays > 0
    ? (((presentDays + excusedDays + lateDays / 2) / totalDays) * 100).toFixed(0)
    : '100';

  const handleExportCSV = () => {
    if (attendanceLogs.length === 0) {
      alert("Aucun émargement à exporter.");
      return;
    }

    // Define headers
    const headers = ["Date", "Statut", "Commentaire / Justification"];

    // Format rows
    const rows = attendanceLogs.map(log => {
      const statusText = getStatusConfig(log.status).text;
      const dateStr = log.date;
      const remarksStr = log.remarks ? `"${log.remarks.replace(/"/g, '""')}"` : "";
      return [dateStr, statusText, remarksStr];
    });

    // Excel-friendly UTF-8 with BOM to display French accents nicely
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

    // Create a Blob and trigger a download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // Sanitize filename mapping
    const studentNameClean = activeStudent?.name 
      ? activeStudent.name.replace(/[^a-zA-Z0-9\s]/g, '_').trim()
      : 'eleve';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `assiduite_${studentNameClean}_${dateStr}.csv`;

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusConfig = (st: AttendanceStatus) => {
    switch (st) {
      case 'Present':
        return {
          icon: CheckCircle2,
          text: 'Présent',
          color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
          badge: 'bg-emerald-100 text-emerald-800'
        };
      case 'Absent':
        return {
          icon: XCircle,
          text: 'Absent Non Justifié',
          color: 'text-red-600 bg-red-50 border-red-100',
          badge: 'bg-red-100 text-red-800'
        };
      case 'Late':
        return {
          icon: Clock,
          text: 'Arrivée Tardive',
          color: 'text-amber-600 bg-amber-50 border-amber-100',
          badge: 'bg-amber-100 text-amber-800'
        };
      case 'Excused':
        return {
          icon: CheckCircle2,
          text: 'Absence Justifiée',
          color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
          badge: 'bg-indigo-100 text-indigo-800'
        };
    }
  };

  const handleOpenForm = () => {
    if (activeStudent?.attendanceValidated) {
      alert("🔒 Impossible d'émarger : Le registre d'assiduité de cet élève est validé et scellé.");
      return;
    }
    if (hasPedPassword && !isPedAuthorized && onPromptUnlockPed) {
      onPromptUnlockPed();
      return;
    }
    setAttDate(new Date().toISOString().split('T')[0]);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) {
      alert('Veuillez sélectionner un élève avant de pouvoir émarger.');
      return;
    }

    if (activeStudent.attendanceValidated) {
      alert("🔒 Le bulletin d'assiduité est verrouillé.");
      return;
    }

    if (onAddAttendance) {
      const newLog: Attendance = {
        id: 'att_' + Date.now(),
        studentId: activeStudent.id,
        parentId: activeStudent.parentId,
        date: attDate,
        status,
        remarks: remarks.trim() || undefined
      };

      const success = await onAddAttendance(newLog);
      if (success) {
        setRemarks('');
        setShowAddForm(false);
      }
    }
  };

  const handleDelete = async (id: string, dateStr: string) => {
    if (activeStudent?.attendanceValidated) {
      alert("🔒 Impossible de supprimer : Le registre d'assiduité est validé.");
      return;
    }
    if (hasPedPassword && !isPedAuthorized && onPromptUnlockPed) {
      onPromptUnlockPed();
      return;
    }
    const confirm = window.confirm(`Voulez-vous supprimer l'émargement du ${dateStr} ?`);
    if (confirm && onDeleteAttendance) {
      await onDeleteAttendance(id);
    }
  };

  const handleToggleValidation = async () => {
    if (!activeStudent || !onUpdateStudent) return;
    const isCurrentlyValidated = !!activeStudent.attendanceValidated;
    const confirmMsg = isCurrentlyValidated
      ? `Voulez-vous invalider (déverrouiller) le relevé d'assiduité pour ${activeStudent.name} ? Cela permettra à nouveau les modifications.`
      : `Voulez-vous valider officiellement le relevé d'assiduité pour ${activeStudent.name} ? Une fois validé, plus aucune présence ne pourra être ajoutée ou supprimée.`;
    
    if (window.confirm(confirmMsg)) {
      const updated: Student = {
        ...activeStudent,
        attendanceValidated: !isCurrentlyValidated
      };
      await onUpdateStudent(updated);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-150 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Registre d'Assiduité & Présences
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Consultez le relevé quotidien des présences, retards signalés et justificatifs validés.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {attendanceLogs.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-250 hover:bg-emerald-105 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs hover:text-emerald-800"
              title="Exporter les présences sous format Excel/CSV"
            >
              <Download className="h-4 w-4 text-emerald-600" /> Exporter Excel/CSV
            </button>
          )}

          {onPrintReport && (
            <button
              onClick={onPrintReport}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-250 hover:bg-gray-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <Printer className="h-4 w-4" /> Imprimer le Registre
            </button>
          )}

          {onAddAttendance && (
            <button
              onClick={() => {
                if (hasPedPassword && !isPedAuthorized && onPromptUnlockPed) {
                  onPromptUnlockPed();
                  return;
                }
                setShowQRScanner(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-97"
              title="Scanner de badge d'élève par QR code"
            >
              <QrCode className="h-4 w-4" /> Scanner QR Badge
            </button>
          )}

          <button
            onClick={handleOpenForm}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
              activeStudent?.attendanceValidated
                ? 'bg-slate-100 text-slate-400 border border-slate-205 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-850 text-white'
            }`}
          >
            <Plus className="h-4 w-4" /> Enregistrer Présence
          </button>
        </div>
      </div>

      {/* Validated Attendance Banner locked status */}
      {consecutiveAbsentCount > 3 && activeStudent && (
        <div className="p-4 rounded-2xl border bg-red-50 text-red-950 border-red-200 text-xs flex items-center gap-3 animate-fade-in shadow-2xs">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="space-y-0.5">
            <span className="font-extrabold uppercase tracking-wide text-[10px] text-red-800 flex items-center gap-1">
              🚨 Alerte Automatique : Absence Prolongée ({consecutiveAbsentCount} Jours Consécutifs)
            </span>
            <p className="font-medium text-red-900">
              L'élève <strong>{activeStudent.name}</strong> cumule plus de 3 jours d'absence consécutifs. Une notification d'alerte a été transmise automatiquement au professeur principal assigné (<strong>{activeStudent.teacherName || 'Professeur Principal'}</strong>).
            </p>
          </div>
        </div>
      )}

      {activeStudent?.attendanceValidated && (
        <div className="p-4 rounded-2xl border bg-amber-50/50 text-amber-950 border-amber-250 text-xs flex items-center gap-3 animate-fade-in shadow-2xs">
          <Lock className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="space-y-0.5">
            <span className="font-extrabold uppercase tracking-wide text-[10px] text-amber-800 flex items-center gap-1">
              🔒 Bulletin d'Assiduité Officiellement Validé & Scellé
            </span>
            <p className="font-medium text-amber-900">
              Le responsable pédagogique a validé le registre d'assiduité pour <strong>{activeStudent.name}</strong>. Plus aucune modification, ajout ou suppression d'émargement de présence n'est autorisée.
            </p>
          </div>
        </div>
      )}

      {/* Security Status Header */}
      {hasPedPassword && (
        <div className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isPedAuthorized ? 'bg-emerald-50 text-emerald-950 border-emerald-150' : 'bg-slate-50 text-slate-800 border-slate-150'
        }`}>
          <div className="flex items-center gap-2">
            {isPedAuthorized ? (
              <Unlock className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="h-4.5 w-4.5 text-slate-500 shrink-0" />
            )}
            <div>
              <span className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide text-[10px] text-slate-650">
                {isPedAuthorized ? '🔓 Mode Responsable Débloqué' : '🔒 Niveau de Sécurité Responsable Pédagogique'}
              </span>
              <p className="font-medium text-slate-600 mt-0.5">
                {isPedAuthorized 
                  ? `Qualité accréditée : ${pedManagerName || "Surveillant Général / Censeur"}`
                  : `La validation ou l'invalidation officielle du bulletin de l'élève requiert le mot de passe de direction.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPedAuthorized && activeStudent && (
              <button
                type="button"
                onClick={handleToggleValidation}
                className={`px-3 py-1.5 font-bold rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shrink-0 border ${
                  activeStudent.attendanceValidated 
                    ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                    : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-700'
                }`}
              >
                {activeStudent.attendanceValidated ? '🔓 Invalider l\'Assiduité' : '🔒 Valider l\'Assiduité'}
              </button>
            )}

            {!isPedAuthorized && onPromptUnlockPed && (
              <button
                onClick={onPromptUnlockPed}
                className="px-3 py-1.5 bg-white text-slate-800 border border-slate-250 font-bold rounded-lg text-[10px] hover:bg-slate-50 uppercase tracking-wider transition cursor-pointer shrink-0"
              >
                Saisir mot de passe
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Attendance Section Form */}
      <AnimatePresence>
        {showAddForm && activeStudent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 shadow-3xs">
              <div className="flex items-center justify-between border-b border-slate-205 pb-2 select-none">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  📋 Émarger une présence officielle pour {activeStudent.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-bold uppercase transition cursor-pointer"
                >
                  Annuler
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Statut de Présence <span className="text-red-500">*</span></label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-850"
                  >
                    <option value="Present">Présent (Classe)</option>
                    <option value="Absent">Absent (Non Justifié)</option>
                    <option value="Late">Arrivée Tardive (Retard)</option>
                    <option value="Excused">Absence Justifiée / Excusée</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Date d'évaluation <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={attDate}
                    onChange={(e) => setAttDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Commentaire / Justification</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Ex: Certificat médical fourni de l'hôpital général."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-250 bg-white text-slate-800 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-slate-50 cursor-pointer text-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer text-center shadow-xs"
                >
                  <CheckCircle2 className="h-4 w-4" /> Valider Émargement
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {attendanceLogs.length === 0 ? (
        <div className="text-center p-12 bg-gray-50/50 rounded-2xl border border-gray-100 select-none">
          <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">Relevé de présences vierge pour cet élève.</p>
        </div>
      ) : (
        <>
          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-white border border-gray-100 rounded-2xl text-center space-y-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Taux de Présence</span>
              <div className="text-3xl font-black text-indigo-600 font-mono">{attendanceRate}%</div>
            </div>

            <div className="p-4 bg-white border border-gray-100 rounded-2xl text-center space-y-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Présences</span>
              <div className="text-3xl font-black text-emerald-600 font-mono">{presentDays}</div>
            </div>

            <div className="p-4 bg-white border border-gray-100 rounded-2xl text-center space-y-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Retards</span>
              <div className="text-3xl font-black text-amber-500 font-mono">{lateDays}</div>
            </div>

            <div className="p-4 bg-white border border-gray-100 rounded-2xl text-center space-y-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Excusés</span>
              <div className="text-3xl font-black text-indigo-500 font-mono">{excusedDays}</div>
            </div>

            <div className="p-4 bg-white border border-gray-100 rounded-2xl text-center col-span-2 lg:col-span-1 space-y-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Absences</span>
              <div className="text-3xl font-black text-red-500 font-mono">{absentDays}</div>
            </div>
          </div>

          {/* Timeline listing */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Historique d'Émargement Récent</h3>
            <div className="relative border-l-2 border-gray-150 pl-6 ml-3 space-y-5">
              {attendanceLogs.map((log, idx) => {
                const config = getStatusConfig(log.status);
                const Icon = config.icon;
                const dateLabel = new Date(log.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                const isCustom = log.id.startsWith('att_') && Number(log.id.split('_')[1]) > 10000;

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="relative group"
                  >
                    {/* Timeline bullet icon */}
                    <div className={`absolute -left-[37px] top-0.5 p-1.5 rounded-full border-2 border-white ${config.color} shadow-sm`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="p-4 bg-white rounded-2xl border border-gray-100 flex items-center justify-between gap-4 flex-wrap hover:shadow-xs transition duration-200">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-gray-700 capitalize">
                            {dateLabel}
                          </span>
                        </div>
                        {log.remarks && (
                          <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-1 bg-slate-50 p-2 rounded-xl border border-slate-100 w-fit">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span>{log.remarks}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.badge} select-none`}>
                          {config.text}
                        </span>

                        {onDeleteAttendance && (
                          <button
                            type="button"
                            onClick={() => handleDelete(log.id, dateLabel)}
                            className={`text-red-650 hover:text-red-800 p-1.5 bg-red-100/10 hover:bg-red-200/20 border border-transparent hover:border-red-500/10 rounded-xl transition duration-200 cursor-pointer ${
                              isPedAuthorized || isCustom ? 'opacity-100' : 'opacity-40 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100'
                            }`}
                            title="Supprimer cette présence"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}
      {/* QR Code Scanner Modal */}
      {showQRScanner && onAddAttendance && (
        <QRScannerModal
          isOpen={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          allStudents={allStudents}
          onAddAttendance={onAddAttendance}
        />
      )}
    </div>
  );
}

