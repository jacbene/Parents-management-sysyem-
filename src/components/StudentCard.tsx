import React, { useState } from 'react';
import { Student, ApeeSettings, ApeeParent, Grade, Attendance } from '../types';
import { Mail, GraduationCap, Calendar, User, UserCheck, Camera, Printer, Phone, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import StudentCameraModal from './StudentCameraModal';

interface StudentCardProps {
  key?: string;
  student: Student;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateStudent?: (updated: Student) => void;
  onPrint?: () => void;
  settings?: ApeeSettings;
  apeeParents?: ApeeParent[];
  grades?: Grade[];
  attendanceLogs?: Attendance[];
}

const isImageAvatar = (avatar: string) => {
  return avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/');
};

export default function StudentCard({ student, isSelected, onSelect, onUpdateStudent, onPrint, settings, apeeParents, grades, attendanceLogs }: StudentCardProps) {
  const [showCamera, setShowCamera] = useState(false);

  // Find titular teacher for classroom in settings
  const foundTeacher = settings?.classTeachers?.find(t => {
    const classRoomName = student.classRoom || '';
    return t.classRoom.toLowerCase() === classRoomName.toLowerCase() || 
           classRoomName.toLowerCase().includes(t.classRoom.toLowerCase()) ||
           t.classRoom.toLowerCase().includes(classRoomName.toLowerCase());
  });

  const teacherName = foundTeacher?.teacherName || student.teacherName || 'Enseignant principal';
  const teacherEmail = foundTeacher?.teacherEmail || student.teacherEmail || '';

  // Find matching parent/guardian details
  const getMatchingParent = (): ApeeParent | undefined => {
    if (!apeeParents) return undefined;
    if (student.id.startsWith('stu_')) {
      const parts = student.id.split('_');
      if (parts.length >= 3 && parts[0] === 'stu') {
        const parentId = parts.slice(1, -1).join('_');
        const found = apeeParents.find(p => p.id === parentId);
        if (found) return found;
      }
    }
    const foundByName = apeeParents.find(p =>
      p.students?.some(stu => stu.name.trim().toLowerCase() === student.name.trim().toLowerCase())
    );
    if (foundByName) return foundByName;
    return undefined;
  };

  const matchingParent = getMatchingParent();

  // Calculate best and worst subjects
  const studentGrades = (grades || []).filter(g => g.studentId === student.id);
  const subjectAveragesMap: { [subj: string]: { sumBase20: number; count: number } } = {};
  studentGrades.forEach(g => {
    const scoreOn20 = (g.score / g.maxScore) * 20;
    if (!subjectAveragesMap[g.subject]) {
      subjectAveragesMap[g.subject] = { sumBase20: 0, count: 0 };
    }
    subjectAveragesMap[g.subject].sumBase20 += scoreOn20;
    subjectAveragesMap[g.subject].count += 1;
  });

  const subjectAverages = Object.keys(subjectAveragesMap).map(subj => {
    const stats = subjectAveragesMap[subj];
    return {
      subject: subj,
      avg: stats.sumBase20 / stats.count
    };
  });

  let bestSubject = null;
  let worstSubject = null;

  if (subjectAverages.length > 0) {
    const sorted = [...subjectAverages].sort((a, b) => b.avg - a.avg);
    bestSubject = sorted[0];
    worstSubject = sorted[sorted.length - 1];
  }

  // Calculate attendance rate
  const studentAttendance = (attendanceLogs || []).filter(a => a.studentId === student.id);
  const totalLogs = studentAttendance.length;
  const presentCount = studentAttendance.filter(a => a.status === 'Present').length;
  const excusedCount = studentAttendance.filter(a => a.status === 'Excused').length;
  const presenceRate = totalLogs > 0
    ? (((presentCount + excusedCount) / totalLogs) * 100).toFixed(1)
    : '100.0';

  return (
    <>
      <motion.div
        onClick={onSelect}
        className={`StudentCard relative p-5 rounded-2xl border transition-all cursor-pointer duration-300 ${
          isSelected
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
            : 'bg-white border-gray-100 text-gray-900 hover:border-gray-200 hover:shadow-sm'
        }`}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex gap-4 items-start">
          <div className="relative shrink-0">
            {/* Avatar display frame with interactive hover overlay */}
            <div 
              onClick={(e) => {
                e.stopPropagation(); // prevent selecting the card
                setShowCamera(true);
              }}
              className={`group w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center relative border cursor-pointer transition-all duration-300 ${
                isSelected 
                  ? 'border-indigo-400 bg-white/10 hover:bg-white/20' 
                  : 'border-gray-150 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/25'
              }`}
              title="Cliquer pour changer la photo"
            >
              {isImageAvatar(student.avatar) ? (
                <img 
                  src={student.avatar} 
                  alt={student.name} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <span className="text-3xl font-sans transition-transform duration-300 group-hover:scale-110" role="img" aria-label="student avatar">
                  {student.avatar}
                </span>
              )}
              {/* Sleek cover overlay for photo customization */}
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white">
                <Camera className="h-4.5 w-4.5" />
                <span className="text-[7.5px] font-sans font-black uppercase tracking-wider mt-0.5">Éditer</span>
              </div>
            </div>

            {/* Quick Camera Badge Trigger */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // prevent selecting the card
                setShowCamera(true);
              }}
              className={`absolute -bottom-1 -right-1 p-1 rounded-full border shadow-xs hover:scale-110 active:scale-95 transition-all text-xs cursor-pointer ${
                isSelected 
                  ? 'bg-amber-500 border-amber-400 text-white hover:bg-amber-600' 
                  : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700'
              }`}
              title="Prendre une photo de l'élève"
            >
              <Camera className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h3 className={`font-bold font-sans text-base truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                {student.name}
              </h3>
              {isSelected && <span className="bg-white/20 text-white text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0"><UserCheck className="h-2.5 w-2.5" /> Actif</span>}
            </div>
            <p className={`text-xs ${isSelected ? 'text-indigo-100' : 'text-gray-500'} font-medium`}>
              {student.grade} • {student.classRoom}
            </p>
            <div className="pt-2 border-t border-dashed mt-2 border-white/10 space-y-1 text-[11px] sm:text-xs">
              <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">Enseignant : <strong className={isSelected ? 'text-white' : 'text-gray-700'}>{teacherName}</strong></span>
              </div>
              <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">Tuteur : <strong className={isSelected ? 'text-white' : 'text-gray-700'}>{matchingParent?.name || 'Non renseigné'}</strong></span>
              </div>
              {matchingParent?.phone && (
                <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">Tél Parent : <strong className={isSelected ? 'text-white font-mono' : 'text-gray-700 font-mono'}>{matchingParent.phone}</strong></span>
                </div>
              )}
              <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                <TrendingUp className={`h-3 w-3 shrink-0 ${isSelected ? 'text-indigo-200' : 'text-emerald-600'}`} />
                <span className="truncate">Best : <strong className={isSelected ? 'text-white' : 'text-emerald-700 font-bold'}>{bestSubject ? `${bestSubject.subject} (${bestSubject.avg.toFixed(1)}/20)` : 'N/A'}</strong></span>
              </div>
              <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                <TrendingDown className={`h-3 w-3 shrink-0 ${isSelected ? 'text-indigo-200' : 'text-rose-600'}`} />
                <span className="truncate">Pire : <strong className={isSelected ? 'text-white' : 'text-rose-700 font-bold'}>{worstSubject ? `${worstSubject.subject} (${worstSubject.avg.toFixed(1)}/20)` : 'N/A'}</strong></span>
              </div>
              <div className={`flex items-center gap-1.5 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">Assiduité : <strong className={isSelected ? 'text-white font-mono' : 'text-gray-700 font-mono'}>{presenceRate}%</strong></span>
              </div>
            </div>

            {/* Print Action Button */}
            {isSelected && onPrint && (
              <div className="pt-3 mt-3 border-t border-white/20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrint();
                  }}
                  className="bg-white hover:bg-slate-50 text-indigo-700 font-extrabold text-[10.5px] px-3 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all w-full justify-center active:scale-97"
                  title="Générer un dossier d'élève imprimable"
                >
                  <Printer className="h-3.5 w-3.5 shrink-0" />
                  <span>Imprimer fiche élève</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modal interface rendered dynamically */}
      {showCamera && onUpdateStudent && (
        <StudentCameraModal
          student={student}
          isOpen={showCamera}
          onClose={() => setShowCamera(false)}
          onUpdate={onUpdateStudent}
        />
      )}
    </>
  );
}
