import React, { useEffect, useState } from 'react';
import { Student, ApeeSettings } from '../types';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Printer, Download, QrCode, ShieldCheck, User } from 'lucide-react';

interface StudentQRBadgeProps {
  student: Student;
  settings?: ApeeSettings;
  isFr?: boolean;
}

// Helper to generate initials from name
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

// Common function to draw a single badge inside a jsPDF instance
export function drawSingleBadge(
  doc: jsPDF,
  student: Student,
  x: number,
  y: number,
  width: number,
  height: number,
  qrDataUrl: string,
  schoolName: string
) {
  // 1. Draw outer boundary (slate border)
  doc.setDrawColor(180, 190, 200);
  doc.setLineWidth(0.4);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, height, 4, 4, 'FD');

  // 2. Decorative Top Header Band (Dark Slate)
  doc.setFillColor(30, 41, 59);
  // We use a custom shape or path for a modern header, but a clean rect is standard and sharp
  doc.rect(x + 0.2, y + 0.2, width - 0.4, 11, 'F');

  // White header text
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  const truncSchoolName = schoolName.length > 34 ? schoolName.substring(0, 32) + "..." : schoolName;
  doc.text(truncSchoolName.toUpperCase(), x + 4, y + 5);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(180, 200, 240);
  doc.text("CARTE D'IDENTITÉ SCOLAIRE • PASMA", x + 4, y + 9.5);

  // Decorative header badge icon representation (small blue circle)
  doc.setFillColor(59, 130, 246);
  doc.circle(x + width - 6, y + 5.5, 1.5, 'F');

  // 3. Student Avatar / Monogram circle on the left
  // Circle coordinates
  const avatarX = x + 16;
  const avatarY = y + 25;
  const avatarRadius = 8;

  // Let's draw the circle background
  doc.setFillColor(79, 70, 229); // Indigo
  doc.circle(avatarX, avatarY, avatarRadius, 'F');

  // Initials text inside circle
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  const initials = getInitials(student.name);
  doc.text(initials, avatarX - 3.5, avatarY + 2.8);

  // 4. Student Name & Credentials (under the monogram)
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('Helvetica', 'bold');
  
  // Font size auto-scale for long names
  if (student.name.length > 20) {
    doc.setFontSize(8);
  } else {
    doc.setFontSize(9.5);
  }
  doc.text(student.name, x + 5, y + 41);

  // Classroom
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(x + 5, y + 44, 25, 4.5, 1, 1, 'F');
  
  doc.setTextColor(79, 70, 229); // Indigo
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(student.classRoom || "NON SPÉCIFIÉE", x + 7, y + 47.3);

  // Matricule/ID Label
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(5.5);
  const displayId = student.id.startsWith('stu_') ? student.id.substring(4, 14).toUpperCase() : student.id.substring(0, 10).toUpperCase();
  doc.text(`MATRICULE : ${displayId}`, x + 5, y + 52);

  // 5. QR Code on the right side
  const qrX = x + 55;
  const qrY = y + 15;
  const qrSize = 28;

  // Render QR code image
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // Helper text below QR Code
  doc.setTextColor(71, 85, 105); // slate-600
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.text("SCANNER POUR L'APPEL", qrX + 4.5, y + 46.5);

  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(4.2);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("Validé par l'Administration", qrX + 5, y + 49.5);

  // 6. Fine print footer
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.2);
  doc.line(x + 4, y + 54.5, x + width - 4, y + 54.5);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Système d'émargement biométrique intelligent", x + 6, y + 58);
}

// Function to export single badge as PDF
export async function generateSingleBadgePDF(student: Student, settings?: ApeeSettings) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [95, 65] // Custom size for one single badge (95mm x 65mm with 2.5mm bleed)
  });

  const schoolName = settings?.associationName || "ÉTABLISSEMENT SCOLAIRE";
  
  try {
    // Generate QR code base64 URL
    const qrDataUrl = await QRCode.toDataURL(student.id, { margin: 1, scale: 6 });
    
    // Draw the badge
    drawSingleBadge(doc, student, 2.5, 2.5, 90, 60, qrDataUrl, schoolName);
    
    // Save
    const fileName = `Badge_${student.name.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error("Failed to generate single badge PDF:", error);
    return false;
  }
}

// Function to export bulk badges for a whole classroom
export async function generateBulkBadgesPDF(students: Student[], settings?: ApeeSettings, className?: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const schoolName = settings?.associationName || "ÉTABLISSEMENT SCOLAIRE";
  const label = className ? `CLASSE ${className.toUpperCase()}` : "ÉLÈVES";

  // Margins & Dimensions
  const badgeWidth = 90;
  const badgeHeight = 60;
  const colGap = 10;
  const rowGap = 8;
  const leftMargin = 10;
  const topMargin = 15;

  let count = 0;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    
    // Create new page after 8 badges
    if (count > 0 && count % 8 === 0) {
      doc.addPage();
    }

    const pageIndex = count % 8;
    const col = pageIndex % 2; // 0 or 1
    const row = Math.floor(pageIndex / 2); // 0, 1, 2, or 3

    const x = leftMargin + col * (badgeWidth + colGap);
    const y = topMargin + row * (badgeHeight + rowGap);

    try {
      const qrDataUrl = await QRCode.toDataURL(student.id, { margin: 1, scale: 5 });
      drawSingleBadge(doc, student, x, y, badgeWidth, badgeHeight, qrDataUrl, schoolName);
    } catch (err) {
      console.error(`Failed to generate badge for ${student.name}:`, err);
    }

    count++;
  }

  const fileName = `Badges_QR_${label.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
  return true;
}

export default function StudentQRBadge({ student, settings, isFr = true }: StudentQRBadgeProps) {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    QRCode.toDataURL(student.id, {
      margin: 1,
      scale: 6,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff'
      }
    })
      .then(url => {
        setQrUrl(url);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error generating QR code:", err);
        setLoading(false);
      });
  }, [student.id]);

  const handleDownloadSingle = async () => {
    await generateSingleBadgePDF(student, settings);
  };

  const schoolName = settings?.associationName || "ÉTABLISSEMENT SCOLAIRE";

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      
      {/* Badge Frame Container styled with elegant Tailwind CSS */}
      <div className="relative w-full max-w-sm aspect-[3/2] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transform transition hover:scale-[1.02] duration-300">
        
        {/* Top Header Card */}
        <div className="bg-slate-900 dark:bg-slate-950 p-4 pb-3 flex justify-between items-center text-white">
          <div className="space-y-0.5">
            <h5 className="text-[10px] font-black tracking-wider text-indigo-400 uppercase truncate max-w-[200px]">
              {schoolName}
            </h5>
            <p className="text-[8px] font-bold text-slate-300 tracking-wide uppercase">
              {isFr ? "CARTE D'ACCÈS ÉLÈVE" : "PUPIL ID BADGE"}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">
            <ShieldCheck className="h-3 w-3" />
            <span>PASMA LIVE</span>
          </div>
        </div>

        {/* Badge Card Body Grid */}
        <div className="p-5 grid grid-cols-5 gap-4 items-center">
          
          {/* Left info column: Avatar, name, class */}
          <div className="col-span-3 space-y-3">
            
            {/* Student visual avatar / monogram */}
            <div className="flex items-center gap-2.5">
              {student.avatar ? (
                <img 
                  src={student.avatar} 
                  alt={student.name} 
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-full object-cover border-2 border-indigo-100 dark:border-indigo-900/60 shadow-sm"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-indigo-650 text-white font-black text-sm flex items-center justify-center border-2 border-indigo-100 dark:border-indigo-900/40 shadow-sm">
                  {getInitials(student.name)}
                </div>
              )}
              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wide">
                  {isFr ? "Élève" : "Student"}
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-white leading-tight block">
                  {student.name}
                </span>
              </div>
            </div>

            {/* Class Pill Tag */}
            <div className="space-y-1">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wide">
                {isFr ? "Classe d'affectation" : "Classroom"}
              </span>
              <span className="inline-block bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30">
                🏫 {student.classRoom || "N/A"}
              </span>
            </div>

            {/* Student Code / ID */}
            <div>
              <span className="text-[8px] text-slate-400 dark:text-slate-550 font-bold block tracking-wider uppercase">
                ID Tracker
              </span>
              <span className="text-[10px] font-mono text-slate-650 dark:text-slate-350 font-semibold">
                {student.id.replace('stu_', '').toUpperCase()}
              </span>
            </div>

          </div>

          {/* Right QR Code column */}
          <div className="col-span-2 flex flex-col items-center justify-center space-y-1.5 border-l border-slate-100 dark:border-slate-800/80 pl-4">
            {loading ? (
              <div className="h-24 w-24 bg-slate-50 dark:bg-slate-950 rounded-xl animate-pulse flex items-center justify-center">
                <QrCode className="h-6 w-6 text-slate-300 animate-spin" />
              </div>
            ) : (
              qrUrl && (
                <div className="bg-white p-1.5 rounded-xl shadow-xs border border-slate-150">
                  <img 
                    src={qrUrl} 
                    alt="Student Attendance Tracker QR Code" 
                    className="h-24 w-24 object-contain"
                  />
                </div>
              )
            )}
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">
              {isFr ? "Scanner à l'appel" : "Scan to check-in"}
            </span>
          </div>

        </div>

        {/* Fine print footer */}
        <div className="absolute bottom-0 inset-x-0 bg-slate-50 dark:bg-slate-950/60 py-1.5 px-4 border-t border-slate-100 dark:border-slate-800/60 text-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
            {isFr ? "ÉCOLE PRIMAIRE - ACCÈS SÉCURISÉ" : "PRIMARY SCHOOL SMART BADGE"}
          </span>
        </div>

      </div>

      {/* Action triggers */}
      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={handleDownloadSingle}
          className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          <span>{isFr ? "Imprimer le Badge (PDF)" : "Print ID Badge (PDF)"}</span>
        </button>
      </div>

    </div>
  );
}
