import React, { useState } from 'react';
import { Appointment, Student } from '../types';
import { Calendar, User, Clock, CheckCircle2, AlertTriangle, Video, MapPin, Plus, X, CalendarCheck2, GripVertical, LayoutGrid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface AppointmentsSchedulerProps {
  appointments: Appointment[];
  students: Student[];
  onAddAppointment: (newApt: Appointment) => void;
  onUpdateAppointment?: (updatedApt: Appointment) => void;
}

export default function AppointmentsScheduler({ appointments, students, onAddAppointment, onUpdateAppointment }: AppointmentsSchedulerProps) {
  const [showForm, setShowForm] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [subject, setSubject] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Drag and Drop & View modes
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [isDraggingId, setIsDraggingId] = useState<string | null>(null);
  const [dragOverDateStr, setDragOverDateStr] = useState<string | null>(null);

  // States for confirmation dialog on Drop (rescheduling)
  const [reschedulingApt, setReschedulingApt] = useState<Appointment | null>(null);
  const [reschedulingTargetDate, setReschedulingTargetDate] = useState<Date | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/80';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/80';
    }
  };

  const getUpcomingDays = () => {
    const days = [];
    const start = new Date();
    // Start of today (midnight local time)
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const isSameDay = (date1: Date, date2Str: string) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2Str);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingApt || !reschedulingTargetDate || !rescheduleTime) return;

    setUpdating(true);
    
    // Combine date of target and time of input
    const [hours, minutes] = rescheduleTime.split(':').map(Number);
    const updatedDate = new Date(reschedulingTargetDate);
    updatedDate.setHours(hours);
    updatedDate.setMinutes(minutes);
    updatedDate.setSeconds(0);
    updatedDate.setMilliseconds(0);

    const updatedApt: Appointment = {
      ...reschedulingApt,
      dateTime: updatedDate.toISOString(),
      notes: rescheduleNotes
    };

    try {
      await setDoc(doc(db, 'appointments', updatedApt.id), updatedApt);
      if (onUpdateAppointment) {
        onUpdateAppointment(updatedApt);
      }
      setReschedulingApt(null);
      setReschedulingTargetDate(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${updatedApt.id}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !teacherName || !subject || !dateStr || !timeStr) return;

    setProcessing(true);
    const id = `apt_${Date.now().toString().slice(-6)}`;
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    // Combine date and time
    const dateTime = new Date(`${dateStr}T${timeStr}:00`).toISOString();

    const newApt: Appointment = {
      id,
      studentId: selectedStudentId,
      parentId: student.parentId,
      teacherName,
      subject,
      dateTime,
      status: 'Scheduled',
      notes: notes || ""
    };

    try {
      await setDoc(doc(db, 'appointments', id), newApt);
      onAddAppointment(newApt);
      setShowForm(false);
      // Reset
      setSelectedStudentId('');
      setTeacherName('');
      setSubject('');
      setDateStr('');
      setTimeStr('');
      setNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `appointments/${id}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4 border-gray-100 dark:border-slate-800 flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-indigo-600" />
            Rencontres Parents-Enseignants (RDV)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Prenez rendez-vous en ligne avec l'équipe pédagogique et suivez votre calendrier de réunions.
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer hover:bg-indigo-700 transition"
        >
          <Plus className="h-4 w-4" /> Solliciter une Réunion
        </button>
      </div>

      {/* View Selector & Drag Hint */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-150 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Mode d'affichage :</span>
          <div className="flex bg-slate-200/60 dark:bg-slate-800/80 p-1 rounded-xl gap-1">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Planning</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Liste</span>
            </button>
          </div>
        </div>

        {viewMode === 'board' && appointments.length > 0 && (
          <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 animate-pulse bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-full border border-indigo-100/50 dark:border-indigo-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            <span>Astuce : Glissez-déposez un rendez-vous pour le replanifier rapidement</span>
          </p>
        )}
      </div>

      {appointments.length === 0 ? (
        <div className="text-center p-12 bg-gray-50/50 rounded-2xl border border-gray-100 dark:bg-slate-900/40 dark:border-slate-800">
          <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium dark:text-gray-400">Aucun rendez-vous planifié.</p>
        </div>
      ) : viewMode === 'board' ? (
        <div className="overflow-x-auto pb-4 pt-1 select-none">
          <div className="flex gap-4 min-w-[1000px] xl:min-w-0 xl:grid xl:grid-cols-7">
            {getUpcomingDays().map((day) => {
              const dayStr = day.toDateString();
              const isOver = dragOverDateStr === dayStr;
              const dayApts = appointments.filter(apt => isSameDay(day, apt.dateTime));

              // Format date
              const dayName = day.toLocaleDateString('fr-FR', { weekday: 'short' });
              const dayNum = day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
              const isToday = isSameDay(day, new Date().toISOString());

              return (
                <div
                  key={dayStr}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverDateStr !== dayStr) {
                      setDragOverDateStr(dayStr);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverDateStr === dayStr) {
                      setDragOverDateStr(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverDateStr(null);
                    const aptId = e.dataTransfer.getData("text/plain");
                    if (!aptId) return;
                    const apt = appointments.find(a => a.id === aptId);
                    if (apt) {
                      const originalTime = new Date(apt.dateTime);
                      const hours = String(originalTime.getHours()).padStart(2, '0');
                      const minutes = String(originalTime.getMinutes()).padStart(2, '0');
                      
                      setReschedulingApt(apt);
                      setReschedulingTargetDate(day);
                      setRescheduleTime(`${hours}:${minutes}`);
                      setRescheduleNotes(apt.notes || '');
                    }
                  }}
                  className={`flex-1 rounded-2xl border p-3.5 transition-all duration-205 flex flex-col gap-3 min-h-[380px] ${
                    isOver
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                      : isToday
                      ? 'border-indigo-150 bg-indigo-50/10 dark:border-indigo-950/40 dark:bg-indigo-950/10'
                      : 'border-slate-150 bg-slate-50/10 dark:border-slate-800 dark:bg-slate-900/10'
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between border-b pb-2.5 border-slate-100 dark:border-slate-800">
                    <div className="min-w-0">
                      <span className={`text-[9px] font-black uppercase tracking-wider block ${isToday ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400 dark:text-slate-500'}`}>
                        {dayName} {isToday ? "(Aujourd'hui)" : ""}
                      </span>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-250 truncate">{dayNum}</h4>
                    </div>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                      {dayApts.length}
                    </span>
                  </div>

                  {/* Column Content */}
                  <div className="flex-1 space-y-2.5 overflow-y-auto">
                    {dayApts.map((apt) => {
                      const studentRef = students.find(s => s.id === apt.studentId);
                      return (
                        <div
                          key={apt.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", apt.id);
                            setIsDraggingId(apt.id);
                          }}
                          onDragEnd={() => {
                            setIsDraggingId(null);
                            setDragOverDateStr(null);
                          }}
                          className={`p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:border-indigo-400 dark:hover:border-indigo-650 transition shadow-2xs group relative ${
                            isDraggingId === apt.id ? 'opacity-30 border-dashed border-indigo-400 bg-indigo-50/20' : ''
                          }`}
                        >
                          {/* Drag Icon Indicator on Hover */}
                          <div className="absolute right-2 top-2 text-slate-350 dark:text-slate-600 opacity-50 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="h-3 w-3" />
                          </div>

                          <div className="space-y-1.5 pr-2">
                            <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md border ${getStatusBadge(apt.status)}`}>
                              {apt.status === 'Completed' ? 'Réalisé' : apt.status === 'Cancelled' ? 'Annulé' : 'Planifié'}
                            </span>

                            <h5 className="font-bold text-slate-850 dark:text-slate-100 text-[11px] leading-snug line-clamp-2">
                              {apt.subject}
                            </h5>

                            <div className="text-[9px] text-slate-500 dark:text-slate-400 space-y-0.5">
                              <div className="flex items-center gap-1">
                                <User className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">Prof : <strong>{apt.teacherName}</strong></span>
                              </div>
                              <div className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                                <Clock className="h-2.5 w-2.5 shrink-0" />
                                <span>{new Date(apt.dateTime).toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit' })}</span>
                              </div>
                            </div>

                            {studentRef && (
                              <div className="text-[9px] text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                {studentRef.avatar.startsWith('data:image') || studentRef.avatar.startsWith('http') || studentRef.avatar.startsWith('/') ? (
                                  <img src={studentRef.avatar} alt={studentRef.name} className="w-4 h-4 object-cover rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="text-[10px]">{studentRef.avatar}</span>
                                )}
                                <span className="truncate">{studentRef.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {dayApts.length === 0 && (
                      <div className="h-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/30 dark:bg-slate-900/5">
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 text-center uppercase tracking-wider leading-relaxed p-2">
                          Glisser RDV ici
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appointments.map((apt, idx) => {
            const studentRef = students.find(s => s.id === apt.studentId);
            return (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-5 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl flex flex-col justify-between hover:shadow-xs transition duration-200"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(apt.status)}`}>
                      {apt.status === 'Completed' ? 'Réalisé' : apt.status === 'Cancelled' ? 'Annulé' : 'Planifié'}
                    </span>
                    <span className="text-xs font-mono text-gray-400 dark:text-gray-500">ID: {apt.id}</span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base">{apt.subject}</h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-medium">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      <span>Professeur : <strong className="text-gray-700 dark:text-gray-300">{apt.teacherName}</strong></span>
                    </div>
                     {studentRef && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1.5">
                        {studentRef.avatar.startsWith('data:image') || studentRef.avatar.startsWith('http') || studentRef.avatar.startsWith('/') ? (
                          <img src={studentRef.avatar} alt={studentRef.name} className="w-5 h-5 object-cover rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                        ) : (
                          <span role="img" aria-label="student link">{studentRef.avatar}</span>
                        )}
                        <span>Élève concerné : {studentRef.name}</span>
                      </div>
                    )}
                  </div>

                  {apt.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl">
                      "{apt.notes}"
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800 flex items-center gap-4 text-xs font-bold text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(apt.dateTime).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(apt.dateTime).toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Booking Consultation Modal Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg border border-gray-100 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto"
            >
              <div className="p-5 bg-indigo-600 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-black">Planifier un Rendez-vous</h3>
                  <p className="text-xs text-indigo-100">Négociez une période de rencontre avec un enseignant.</p>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-white/60 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-indigo-700/50 transition shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAppointment} className="p-6 space-y-4 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-400">Sélectionner l'élève</label>
                    <select
                      required
                      value={selectedStudentId}
                      onChange={(e) => {
                        const sId = e.target.value;
                        setSelectedStudentId(sId);
                        // Auto-select corresponding teacher
                        const studentObj = students.find(s => s.id === sId);
                        if (studentObj) {
                          setTeacherName(studentObj.teacherName);
                          setSubject(`Consultation de bilan - ${studentObj.name}`);
                        }
                      }}
                      className="w-full px-3.5 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100"
                    >
                      <option value="">-- Choisir un enfant --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-400">Nom de l'enseignant</label>
                    <input
                      type="text"
                      required
                      placeholder="M. Jean Picard"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 text-gray-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600 dark:text-slate-400">Objet de l'entretien</label>
                  <input
                    type="text"
                    required
                    placeholder="Bilan pédagogique trimestriel"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 text-gray-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-400">Date souhaitée</label>
                    <input
                      type="date"
                      required
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 text-gray-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 dark:text-slate-400">Heure souhaitée</label>
                    <input
                      type="time"
                      required
                      value={timeStr}
                      onChange={(e) => setTimeStr(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 text-gray-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600 dark:text-slate-400">Remarques / Questions complémentaires (Facultatif)</label>
                  <textarea
                    rows={3}
                    placeholder="Précisez les points que vous souhaitez aborder durant l'entretien..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 text-gray-800 dark:text-slate-100"
                  />
                </div>

                <div className="pt-2 sticky bottom-0 bg-white dark:bg-slate-900">
                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    {processing ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Envoi de la demande...
                      </>
                    ) : (
                      "Consigner la Demande d'Entretien"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reschedule Confirmation Modal */}
      <AnimatePresence>
        {reschedulingApt && reschedulingTargetDate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto"
            >
              <div className="p-5 bg-indigo-600 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-black">Replanifier le Rendez-vous</h3>
                  <p className="text-xs text-indigo-100">Ajustez l'heure pour déplacer la rencontre.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReschedulingApt(null);
                    setReschedulingTargetDate(null);
                  }}
                  className="text-white/60 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-indigo-700/50 transition shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmReschedule} className="p-6 space-y-4 text-slate-800 dark:text-slate-100">
                <div className="space-y-1 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider block">Sujet</span>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-snug">{reschedulingApt.subject}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Professeur : {reschedulingApt.teacherName}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-550 dark:text-slate-400 block">Nouvelle date</label>
                    <div className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-850 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300">
                      {reschedulingTargetDate.toLocaleDateString('fr-FR', { dateStyle: 'medium' })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-550 dark:text-slate-400 block">Nouvel horaire</label>
                    <input
                      type="time"
                      required
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-sm font-extrabold focus:outline-hidden focus:ring-1.5 focus:ring-indigo-500 text-slate-850 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-550 dark:text-slate-400 block">Remarques ou motif du report (Facultatif)</label>
                  <textarea
                    rows={2}
                    placeholder="Précisez un motif ou une remarque complémentaire..."
                    value={rescheduleNotes}
                    onChange={(e) => setRescheduleNotes(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1.5 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReschedulingApt(null);
                      setReschedulingTargetDate(null);
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer text-center"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    {updating ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      "Confirmer le report"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
