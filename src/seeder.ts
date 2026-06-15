import { collection, doc, writeBatch, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Student, Grade, Attendance, Homework, Appointment, Message, Invoice } from './types';

export async function isDatabaseSeeded(userId: string): Promise<boolean> {
  const q = query(collection(db, 'students'), where('parentId', '==', userId));
  try {
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (err) {
    console.warn("isDatabaseSeeded: Firestore offline or timed out, assuming true to prevent remote write locks in local preview:", err);
    return true;
  }
}

export async function seedUserData(userId: string): Promise<void> {
  try {
    // Batches are written separately per collection

    // 1. Students
    const student1Id = `stu_lucas_${userId.slice(0, 6)}`;
    const student2Id = `stu_chloe_${userId.slice(0, 6)}`;
    const student3Id = `stu_amadou_${userId.slice(0, 6)}`;
    const student4Id = `stu_marc_${userId.slice(0, 6)}`;
    const student5Id = `stu_elise_${userId.slice(0, 6)}`;

    const student1: Student = {
      id: student1Id,
      parentId: userId,
      name: 'Lucas Martin',
      grade: 'CM2 (5ème Année)',
      classRoom: 'Classe de M. Picard (CM2-A)',
      avatar: '👦',
      teacherName: 'M. Jean Picard',
      teacherEmail: 'j.picard@ecole-pasma.fr',
      dob: '2016-04-12'
    };

    const student2: Student = {
      id: student2Id,
      parentId: userId,
      name: 'Chloé Martin',
      grade: 'CE2 (3ème Année)',
      classRoom: 'Classe de Mme Laurent (CE2-B)',
      avatar: '👧',
      teacherName: 'Mme Sophie Laurent',
      teacherEmail: 's.laurent@ecole-pasma.fr',
      dob: '2018-09-21'
    };

    const student3: Student = {
      id: student3Id,
      parentId: userId,
      name: 'Amadou Diallo',
      grade: 'CM1 (4ème Année)',
      classRoom: 'Classe de M. Diallo (CM1-A)',
      avatar: '👦',
      teacherName: 'M. Aliou Diallo',
      teacherEmail: 'aliou.diallo@ecole-pasma.fr',
      dob: '2017-11-04'
    };

    const student4: Student = {
      id: student4Id,
      parentId: userId,
      name: 'Marc Bene',
      grade: 'CM2 (5ème Année)',
      classRoom: 'Classe de M. Picard (CM2-A)',
      avatar: '👦',
      teacherName: 'M. Jean Picard',
      teacherEmail: 'j.picard@ecole-pasma.fr',
      dob: '2016-06-15'
    };

    const student5: Student = {
      id: student5Id,
      parentId: userId,
      name: 'Elise Bene',
      grade: 'CE2 (3ème Année)',
      classRoom: 'Classe de Mme Laurent (CE2-B)',
      avatar: '👧',
      teacherName: 'Mme Sophie Laurent',
      teacherEmail: 's.laurent@ecole-pasma.fr',
      dob: '2018-05-10'
    };

    try {
      const studentBatch = writeBatch(db);
      studentBatch.set(doc(db, 'students', student1Id), student1);
      studentBatch.set(doc(db, 'students', student2Id), student2);
      studentBatch.set(doc(db, 'students', student3Id), student3);
      studentBatch.set(doc(db, 'students', student4Id), student4);
      studentBatch.set(doc(db, 'students', student5Id), student5);
      await studentBatch.commit();
      console.log("[Pasma-sys Seeder] Students seeded successfully.");
    } catch (err) {
      console.warn("[Pasma-sys Seeder] Students seeding skipped or blocked by rules:", err);
    }

    // 2. Grades (Notes)
    const grades: Grade[] = [
      // Lucas Grades
      {
        id: `grd_lucas_1_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        subject: 'Mathématiques',
        examName: 'Évaluation - Fractions et Décimaux',
        score: 17.5,
        maxScore: 20,
        teacherRemarks: 'Excellent travail. Raisonnement rigoureux et très bonne logique.',
        date: '2026-05-18'
      },
      {
        id: `grd_lucas_2_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        subject: 'Sciences',
        examName: 'Contrôle - Le Système Solaire',
        score: 19,
        maxScore: 20,
        teacherRemarks: 'Une présentation impécable et des connaissances très approfondies. Bravo !',
        date: '2026-05-12'
      },
      {
        id: `grd_lucas_3_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        subject: 'Français',
        examName: 'Dictée & Grammaire - Accord du Participe Passé',
        score: 14,
        maxScore: 20,
        teacherRemarks: 'Bien dans l\'ensemble. Attention aux étourderies sur les accords simples.',
        date: '2026-05-05'
      },
      {
        id: `grd_lucas_4_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        subject: 'Histoire',
        examName: 'Évaluation - La Révolution Française',
        score: 15.5,
        maxScore: 20,
        teacherRemarks: 'De solides repères historiques. Continuez ainsi.',
        date: '2026-04-30'
      },

      // Chloé Grades
      {
        id: `grd_chloe_1_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        subject: 'Mathématiques',
        examName: 'Évaluation - Tables de Multiplication',
        score: 18,
        maxScore: 20,
        teacherRemarks: 'Tables parfaitement sues. Les calculs sont rapides et justes.',
        date: '2026-05-19'
      },
      {
        id: `grd_chloe_2_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        subject: 'Français',
        examName: 'Rédaction - Raconter ses vacances',
        score: 16,
        maxScore: 20,
        teacherRemarks: 'Un récit original et imagé. Style agréable à lire, belle écriture.',
        date: '2026-05-14'
      },
      {
        id: `grd_chloe_3_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        subject: 'Arts Plastiques',
        examName: 'Atelier - Peinture et Mélanges de Couleurs',
        score: 20,
        maxScore: 20,
        teacherRemarks: 'Très créative. Chloé s\'est beaucoup investie dans cet atelier artistique.',
        date: '2026-05-08'
      },
      // Amadou Grades
      {
        id: `grd_amadou_1_${userId.slice(0, 6)}`,
        studentId: student3Id,
        parentId: userId,
        subject: 'Mathématiques',
        examName: 'Évaluation - Divisions posées',
        score: 15.5,
        maxScore: 20,
        teacherRemarks: 'Très bon raisonnement, poursuivez les efforts.',
        date: '2026-05-18'
      },
      {
        id: `grd_amadou_2_${userId.slice(0, 6)}`,
        studentId: student3Id,
        parentId: userId,
        subject: 'Français',
        examName: 'Vocabulaire - Les Synonymes',
        score: 16.5,
        maxScore: 20,
        teacherRemarks: 'Excellent vocabulaire réutilisé à bon escient.',
        date: '2026-05-12'
      },
      // Marc Bene Grades
      {
        id: `grd_marc_1_${userId.slice(0, 6)}`,
        studentId: student4Id,
        parentId: userId,
        subject: 'Mathématiques',
        examName: 'Évaluation - Fractions et Décimaux',
        score: 18,
        maxScore: 20,
        teacherRemarks: 'Raisonnement rigoureux et très bonne logique.',
        date: '2026-05-18'
      },
      {
        id: `grd_marc_2_${userId.slice(0, 6)}`,
        studentId: student4Id,
        parentId: userId,
        subject: 'Français',
        examName: 'Dictée & Grammaire - Accord du Participe Passé',
        score: 14.5,
        maxScore: 20,
        teacherRemarks: 'Bonne compréhension générale, poursuivez ainsi.',
        date: '2026-05-05'
      },
      // Elise Bene Grades
      {
        id: `grd_elise_1_${userId.slice(0, 6)}`,
        studentId: student5Id,
        parentId: userId,
        subject: 'Mathématiques',
        examName: 'Évaluation - Tables de Multiplication',
        score: 17,
        maxScore: 20,
        teacherRemarks: 'Chiffres soignés, calcul précis et juste.',
        date: '2026-05-19'
      },
      {
        id: `grd_elise_2_${userId.slice(0, 6)}`,
        studentId: student5Id,
        parentId: userId,
        subject: 'Français',
        examName: 'Rédaction - Raconter ses vacances',
        score: 16,
        maxScore: 20,
        teacherRemarks: 'Un très joli style, agréable à lire.',
        date: '2026-05-14'
      }
    ];

    try {
      const gradeBatch = writeBatch(db);
      grades.forEach(g => {
        gradeBatch.set(doc(db, 'grades', g.id), g);
      });
      await gradeBatch.commit();
      console.log("[Pasma-sys Seeder] Grades seeded successfully.");
    } catch (err) {
      console.warn("[Pasma-sys Seeder] Grades seeding skipped or blocked by rules:", err);
    }

    // 3. Attendance (Présence)
    const attendances: Attendance[] = [
      // Lucas Attendance
      {
        id: `att_lucas_1_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        date: '2026-05-22',
        status: 'Present'
      },
      {
        id: `att_lucas_2_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        date: '2026-05-21',
        status: 'Present'
      },
      {
        id: `att_lucas_3_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        date: '2026-05-20',
        status: 'Late',
        remarks: 'Arrivé à 08h45 - Problème de bus de la ligne 12.'
      },
      {
        id: `att_lucas_4_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        date: '2026-05-19',
        status: 'Present'
      },
      {
        id: `att_lucas_5_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        date: '2026-05-18',
        status: 'Present'
      },

      // Chloé Attendance
      {
        id: `att_chloe_1_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        date: '2026-05-22',
        status: 'Present'
      },
      {
        id: `att_chloe_2_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        date: '2026-05-21',
        status: 'Present'
      },
      {
        id: `att_chloe_3_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        date: '2026-05-20',
        status: 'Present'
      },
      {
        id: `att_chloe_4_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        date: '2026-05-19',
        status: 'Excused',
        remarks: 'Rendez-vous médical annuel chez l\'orthodontiste.'
      },
      {
        id: `att_chloe_5_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        date: '2026-05-18',
        status: 'Present'
      },
      // Amadou Attendance
      {
        id: `att_amadou_1_${userId.slice(0, 6)}`,
        studentId: student3Id,
        parentId: userId,
        date: '2026-05-22',
        status: 'Present'
      },
      {
        id: `att_amadou_2_${userId.slice(0, 6)}`,
        studentId: student3Id,
        parentId: userId,
        date: '2026-05-21',
        status: 'Present'
      },
      {
        id: `att_amadou_3_${userId.slice(0, 6)}`,
        studentId: student3Id,
        parentId: userId,
        date: '2026-05-20',
        status: 'Present'
      },
      // Marc Bene Attendance
      {
        id: `att_marc_1_${userId.slice(0, 6)}`,
        studentId: student4Id,
        parentId: userId,
        date: '2026-05-22',
        status: 'Present'
      },
      {
        id: `att_marc_2_${userId.slice(0, 6)}`,
        studentId: student4Id,
        parentId: userId,
        date: '2026-05-21',
        status: 'Late',
        remarks: 'Retard de 10 min.'
      },
      {
        id: `att_marc_3_${userId.slice(0, 6)}`,
        studentId: student4Id,
        parentId: userId,
        date: '2026-05-20',
        status: 'Present'
      },
      // Elise Bene Attendance
      {
        id: `att_elise_1_${userId.slice(0, 6)}`,
        studentId: student5Id,
        parentId: userId,
        date: '2026-05-22',
        status: 'Present'
      },
      {
        id: `att_elise_2_${userId.slice(0, 6)}`,
        studentId: student5Id,
        parentId: userId,
        date: '2026-05-21',
        status: 'Present'
      }
    ];

    try {
      const attendanceBatch = writeBatch(db);
      attendances.forEach(a => {
        attendanceBatch.set(doc(db, 'attendance', a.id), a);
      });
      await attendanceBatch.commit();
      console.log("[Pasma-sys Seeder] Attendance seeded successfully.");
    } catch (err) {
      console.warn("[Pasma-sys Seeder] Attendance seeding skipped or blocked by rules:", err);
    }

    // 4. Homework (Devoirs)
    const homeworks: Homework[] = [
      // Lucas
      {
        id: `hw_lucas_1_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        subject: 'Mathématiques',
        title: 'Exercices de géométrie - Droites parallèles',
        description: 'Faire les exercices 3, 4 et 7 de la page 112 du cahier de maths.',
        dueDate: '2026-05-26',
        status: 'Pending'
      },
      {
        id: `hw_lucas_2_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        subject: 'Français',
        title: 'Lecture cursive - Chapitres 4 et 5',
        description: 'Lire "Le Petit Prince" chapitres 4 et 5 et répondre aux questions de compréhension.',
        dueDate: '2026-05-25',
        status: 'Pending'
      },
      {
        id: `hw_lucas_3_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        subject: 'Sciences',
        title: 'Recherche - Énergies renouvelables',
        description: 'Préparer un court exposé sur l\'énergie solaire.',
        dueDate: '2026-05-20',
        status: 'Completed',
        grade: 'A'
      },

      // Chloé
      {
        id: `hw_chloe_1_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        subject: 'Anglais',
        title: 'Vocabulaire - Les Animaux de la Ferme',
        description: 'Apprendre la liste d\'anglais numéro 4. Court test écrit prévu.',
        dueDate: '2026-05-26',
        status: 'Pending'
      },
      {
        id: `hw_chloe_2_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        subject: 'Mathématiques',
        title: 'Problèmes d\'additions posées',
        description: 'Résoudre les 4 petits problèmes rédigés sur la fiche cartonnée.',
        dueDate: '2026-05-24',
        status: 'Pending'
      },
      {
        id: `hw_chloe_3_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        subject: 'Français',
        title: 'Poésie - Le Corbeau et le Renard',
        description: 'Réciter les deux premières strophes par cœur.',
        dueDate: '2026-05-18',
        status: 'Completed',
        grade: '18/20'
      },
      // Amadou Homework
      {
        id: `hw_amadou_1_${userId.slice(0, 6)}`,
        studentId: student3Id,
        parentId: userId,
        subject: 'Mathématiques',
        title: 'La division par 2 chiffres',
        description: 'Faire les opérations de la page de révision.',
        dueDate: '2026-05-26',
        status: 'Pending'
      },
      // Marc Bene Homework
      {
        id: `hw_marc_1_${userId.slice(0, 6)}`,
        studentId: student4Id,
        parentId: userId,
        subject: 'Mathématiques',
        title: 'Exercices de géométrie - Droites parallèles',
        description: 'Faire les exercices 3, 4 et 7 de la page 112.',
        dueDate: '2026-05-26',
        status: 'Pending'
      },
      // Elise Bene Homework
      {
        id: `hw_elise_1_${userId.slice(0, 6)}`,
        studentId: student5Id,
        parentId: userId,
        subject: 'Anglais',
        title: 'Vocabulaire - Les Animaux de la Ferme',
        description: 'Apprendre la liste numéro 4.',
        dueDate: '2026-05-26',
        status: 'Pending'
      }
    ];

    try {
      const homeworkBatch = writeBatch(db);
      homeworks.forEach(hw => {
        homeworkBatch.set(doc(db, 'homeworks', hw.id), hw);
      });
      await homeworkBatch.commit();
      console.log("[Pasma-sys Seeder] Homeworks seeded successfully.");
    } catch (err) {
      console.warn("[Pasma-sys Seeder] Homeworks seeding skipped or blocked by rules:", err);
    }

    // 5. Appointments (Rendez-vous)
    const appointments: Appointment[] = [
      {
        id: `apt_1_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        teacherName: 'M. Jean Picard',
        subject: 'Bilan de fin d\'année & orientation 6ème',
        dateTime: '2026-06-02T16:30:00Z',
        status: 'Scheduled',
        notes: 'Discussion globale sur les excellents résultats et la transition vers le collège.'
      },
      {
        id: `apt_2_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        teacherName: 'Mme Sophie Laurent',
        subject: 'Suivi trimestriel en Français',
        dateTime: '2026-05-15T17:00:00Z',
        status: 'Completed',
        notes: 'Chloé est très impliquée. Nous continuerons à soutenir son esprit d\'analyse.'
      },
      // Marc Bene Appointment
      {
        id: `apt_marc_${userId.slice(0, 6)}`,
        studentId: student4Id,
        parentId: userId,
        teacherName: 'M. Jean Picard',
        subject: 'Suivi d\'intégration de Marc',
        dateTime: '2026-06-03T15:00:00Z',
        status: 'Scheduled',
        notes: 'Discussion constructive sur la performance globale de Marc.'
      },
      // Elise Bene Appointment
      {
        id: `apt_elise_${userId.slice(0, 6)}`,
        studentId: student5Id,
        parentId: userId,
        teacherName: 'Mme Sophie Laurent',
        subject: 'Suivi trimestriel - Lecture',
        dateTime: '2026-06-04T16:00:00Z',
        status: 'Scheduled',
        notes: 'Excellent comportement en classe.'
      },
      // Amadou Appointment
      {
        id: `apt_amadou_${userId.slice(0, 6)}`,
        studentId: student3Id,
        parentId: userId,
        teacherName: 'M. Aliou Diallo',
        subject: 'Rencontre Parents-Enseignants',
        dateTime: '2026-05-12T16:00:00Z',
        status: 'Completed',
        notes: 'Amadou travaille bien et participe activement.'
      }
    ];

    try {
      const appointmentsBatch = writeBatch(db);
      appointments.forEach(apt => {
        appointmentsBatch.set(doc(db, 'appointments', apt.id), apt);
      });
      await appointmentsBatch.commit();
      console.log("[Pasma-sys Seeder] Appointments seeded successfully.");
    } catch (err) {
      console.warn("[Pasma-sys Seeder] Appointments seeding skipped or blocked by rules:", err);
    }

    // 6. Invoices (Facturation comptable APEE)
    const invoices: Invoice[] = [
      {
        id: `apee_par_bene_jacques`,
        studentId: 'apee_ces_ekali_1',
        parentId: userId,
        title: 'Bene Jacques',
        amount: 25000,
        dueDate: '2025/2026',
        status: 'Unpaid',
        phone: '687463313',
        address: 'Quartier Ekali',
        email: 'jacquesbene301@gmail.com',
        note: 'Règlement initial pour la rentrée scolaire de Marc et Elise',
        amountPaid: 15000,
        studentsList: JSON.stringify([{ name: 'Marc Bene', classRoom: 'CM2-A' }, { name: 'Elise Bene', classRoom: 'CE2-B' }]),
        paymentsHistory: JSON.stringify([{ id: 'p_bene_1', amount: 15000, date: '2026-05-10', note: 'Versement initial par Mobile Money', method: 'Orange Money' }])
      }
    ];

    try {
      const invoicesBatch = writeBatch(db);
      invoices.forEach(inv => {
        invoicesBatch.set(doc(db, 'invoices', inv.id), inv);
      });
      await invoicesBatch.commit();
      console.log("[Pasma-sys Seeder] Invoices seeded successfully.");
    } catch (err) {
      console.warn("[Pasma-sys Seeder] Invoices seeding skipped or blocked by rules:", err);
    }

    // 7. Messaging (Messages initiés)
    const messages: Message[] = [
      {
        id: `msg_1_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        senderType: 'Teacher',
        content: 'Bonjour, je tenais à vous féliciter personnellement pour l\'implication de Lucas dans le projet d\'exposition scientifique.',
        timestamp: '2026-05-21T09:15:00Z',
        teacherName: 'M. Jean Picard'
      },
      {
        id: `msg_2_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        senderType: 'Parent',
        content: 'Un grand merci pour vos encouragements ! Il a adoré préparer cette présentation sur le système solaire.',
        timestamp: '2026-05-21T14:40:00Z',
        teacherName: 'M. Jean Picard'
      },
      {
        id: `msg_3_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        senderType: 'Teacher',
        content: 'N\'oubliez pas de remplir l\'autorisation parentale pour la sortie de fin d\'année de Chloé de vendredi prochain.',
        timestamp: '2026-05-22T08:30:00Z',
        teacherName: 'Mme Sophie Laurent'
      },
      // Marc Bene Message
      {
        id: `msg_marc_1_${userId.slice(0, 6)}`,
        studentId: student4Id,
        parentId: userId,
        senderType: 'Teacher',
        content: 'Bonjour, Marc s\'adapte très bien à son nouveau groupe classe. Ses résultats en calcul mental sont remarquables.',
        timestamp: '2026-05-21T09:30:00Z',
        teacherName: 'M. Jean Picard'
      },
      // Amadou Diallo Message
      {
        id: `msg_amadou_1_${userId.slice(0, 6)}`,
        studentId: student3Id,
        parentId: userId,
        senderType: 'Teacher',
        content: 'Bonjour, je vous informe que la réunion de suivi d\'Amadou s\'est bien déroulée. Son comportement est irréprochable.',
        timestamp: '2026-05-21T10:15:00Z',
        teacherName: 'M. Aliou Diallo'
      }
    ];

    try {
      const messagesBatch = writeBatch(db);
      messages.forEach(msg => {
        messagesBatch.set(doc(db, 'messages', msg.id), msg);
      });
      await messagesBatch.commit();
      console.log("[Pasma-sys Seeder] Messages seeded successfully.");
    } catch (err) {
      console.warn("[Pasma-sys Seeder] Messages seeding skipped or blocked by rules:", err);
    }

    console.log('Seeding of Parents Management System (Pasma-sys) process ended.');
  } catch (err) {
    console.warn('[Pasma-sys Seeder] General seeding process exception caught:', err);
  }
}

export function getOfflineMockData(userId: string) {
  const student1Id = `stu_lucas_${userId.slice(0, 6)}`;
  const student2Id = `stu_chloe_${userId.slice(0, 6)}`;

  const students: Student[] = [
    {
      id: student1Id,
      parentId: userId,
      name: 'Lucas Martin',
      grade: 'CM2 (5ème Année)',
      classRoom: 'Classe de M. Picard (CM2-A)',
      avatar: '👦',
      teacherName: 'M. Jean Picard',
      teacherEmail: 'j.picard@ecole-pasma.fr',
      dob: '2016-04-12'
    },
    {
      id: student2Id,
      parentId: userId,
      name: 'Chloé Martin',
      grade: 'CE2 (3ème Année)',
      classRoom: 'Classe de Mme Laurent (CE2-B)',
      avatar: '👧',
      teacherName: 'Mme Sophie Laurent',
      teacherEmail: 's.laurent@ecole-pasma.fr',
      dob: '2018-09-21'
    }
  ];

  const grades: Grade[] = [
    {
      id: `grd_lucas_1_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      subject: 'Mathématiques',
      examName: 'Évaluation - Fractions et Décimaux',
      score: 17.5,
      maxScore: 20,
      teacherRemarks: 'Excellent travail. Raisonnement rigoureux et très bonne logique.',
      date: '2026-05-18'
    },
    {
      id: `grd_lucas_2_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      subject: 'Sciences',
      examName: 'Contrôle - Le Système Solaire',
      score: 19,
      maxScore: 20,
      teacherRemarks: 'Une présentation impécable et des connaissances très approfondies. Bravo !',
      date: '2026-05-12'
    },
    {
      id: `grd_lucas_3_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      subject: 'Français',
      examName: 'Dictée & Grammaire - Accord du Participe Passé',
      score: 14,
      maxScore: 20,
      teacherRemarks: 'Bien dans l\'ensemble. Attention aux étourderies sur les accords simples.',
      date: '2026-05-05'
    },
    {
      id: `grd_lucas_4_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      subject: 'Histoire',
      examName: 'Évaluation - La Révolution Française',
      score: 15.5,
      maxScore: 20,
      teacherRemarks: 'De solides repères historiques. Continuez ainsi.',
      date: '2026-04-30'
    },
    {
      id: `grd_chloe_1_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      subject: 'Mathématiques',
      examName: 'Évaluation - Tables de Multiplication',
      score: 18,
      maxScore: 20,
      teacherRemarks: 'Tables parfaitement sues. Les calculs sont rapides et justes.',
      date: '2026-05-19'
    },
    {
      id: `grd_chloe_2_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      subject: 'Français',
      examName: 'Rédaction - Raconter ses vacances',
      score: 16,
      maxScore: 20,
      teacherRemarks: 'Un récit original et imagé. Style agréable à lire, belle écriture.',
      date: '2026-05-14'
    },
    {
      id: `grd_chloe_3_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      subject: 'Arts Plastiques',
      examName: 'Atelier - Peinture et Mélanges de Couleurs',
      score: 20,
      maxScore: 20,
      teacherRemarks: 'Très créative. Chloé s\'est beaucoup investie dans cet atelier artistique.',
      date: '2026-05-08'
    }
  ];

  const attendances: Attendance[] = [
    {
      id: `att_lucas_1_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      date: '2026-05-22',
      status: 'Present'
    },
    {
      id: `att_lucas_2_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      date: '2026-05-21',
      status: 'Present'
    },
    {
      id: `att_lucas_3_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      date: '2026-05-20',
      status: 'Late',
      remarks: 'Arrivé à 08h45 - Problème de bus de la ligne 12.'
    },
    {
      id: `att_lucas_4_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      date: '2026-05-19',
      status: 'Present'
    },
    {
      id: `att_lucas_5_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      date: '2026-05-18',
      status: 'Present'
    },
    {
      id: `att_chloe_1_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      date: '2026-05-22',
      status: 'Present'
    },
    {
      id: `att_chloe_2_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      date: '2026-05-21',
      status: 'Present'
    },
    {
      id: `att_chloe_3_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      date: '2026-05-20',
      status: 'Present'
    },
    {
      id: `att_chloe_4_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      date: '2026-05-19',
      status: 'Excused',
      remarks: 'Rendez-vous médical annuel chez l\'orthodontiste.'
    },
    {
      id: `att_chloe_5_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      date: '2026-05-18',
      status: 'Present'
    }
  ];

  const homeworks: Homework[] = [
    {
      id: `hw_lucas_1_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      subject: 'Mathématiques',
      title: 'Exercices de géométrie - Droites parallèles',
      description: 'Faire les exercices 3, 4 et 7 de la page 112 du cahier de maths.',
      dueDate: '2026-05-26',
      status: 'Pending'
    },
    {
      id: `hw_lucas_2_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      subject: 'Français',
      title: 'Lecture cursive - Chapitres 4 et 5',
      description: 'Lire "Le Petit Prince" chapitres 4 et 5 et répondre aux questions de compréhension.',
      dueDate: '2026-05-25',
      status: 'Pending'
    },
    {
      id: `hw_lucas_3_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      subject: 'Sciences',
      title: 'Recherche - Énergies renouvelables',
      description: 'Préparer un court exposé sur l\'énergie solaire.',
      dueDate: '2026-05-20',
      status: 'Completed',
      grade: 'A'
    },
    {
      id: `hw_chloe_1_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      subject: 'Anglais',
      title: 'Vocabulaire - Les Animaux de la Ferme',
      description: 'Apprendre la liste d\'anglais numéro 4. Court test écrit prévu.',
      dueDate: '2026-05-26',
      status: 'Pending'
    },
    {
      id: `hw_chloe_2_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      subject: 'Mathématiques',
      title: 'Problèmes d\'additions posées',
      description: 'Résoudre les 4 petits problèmes rédigés sur la fiche cartonnée.',
      dueDate: '2026-05-24',
      status: 'Pending'
    },
    {
      id: `hw_chloe_3_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      subject: 'Français',
      title: 'Poésie - Le Corbeau et le Renard',
      description: 'Réciter les deux premières strophes par cœur.',
      dueDate: '2026-05-18',
      status: 'Completed',
      grade: '18/20'
    }
  ];

  const appointments: Appointment[] = [
    {
      id: `apt_1_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      teacherName: 'M. Jean Picard',
      subject: 'Bilan de fin d\'année & orientation 6ème',
      dateTime: '2026-06-02T16:30:00Z',
      status: 'Scheduled',
      notes: 'Discussion globale sur les excellents résultats et la transition vers le collège.'
    },
    {
      id: `apt_2_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      teacherName: 'Mme Sophie Laurent',
      subject: 'Suivi trimestriel en Français',
      dateTime: '2026-05-15T17:00:00Z',
      status: 'Completed',
      notes: 'Chloé est très impliquée. Nous continuerons à soutenir son esprit d\'analyse.'
    }
  ];

  const invoices: Invoice[] = [
    {
      id: `apee_par_bene_jacques`,
      studentId: 'apee_ces_ekali_1',
      parentId: userId,
      title: 'Bene Jacques',
      amount: 25000,
      dueDate: '2025/2026',
      status: 'Unpaid',
      phone: '687463313',
      address: 'Quartier Ekali',
      email: 'jacquesbene301@gmail.com',
      note: 'Règlement initial pour la rentrée scolaire de Marc et Elise',
      amountPaid: 15000,
      studentsList: JSON.stringify([{ name: 'Marc Bene', classRoom: 'CM2-A' }, { name: 'Elise Bene', classRoom: 'CE2-B' }]),
      paymentsHistory: JSON.stringify([{ id: 'p_bene_1', amount: 15000, date: '2026-05-10', note: 'Versement initial par Mobile Money', method: 'Orange Money' }])
    }
  ];

  const messages: Message[] = [
    {
      id: `msg_1_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      senderType: 'Teacher',
      content: 'Bonjour, je tenais à vous féliciter personnellement pour l\'implication de Lucas dans le projet d\'exposition scientifique.',
      timestamp: '2026-05-21T09:15:00Z',
      teacherName: 'M. Jean Picard'
    },
    {
      id: `msg_2_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      senderType: 'Parent',
      content: 'Un grand merci pour vos encouragements ! Il a adoré préparer cette présentation sur le système solaire.',
      timestamp: '2026-05-21T14:40:00Z',
      teacherName: 'M. Jean Picard'
    },
    {
      id: `msg_3_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      senderType: 'Teacher',
      content: 'N\'oubliez pas de remplir l\'autorisation parentale pour la sortie de fin d\'année de Chloé de vendredi prochain.',
      timestamp: '2026-05-22T08:30:00Z',
      teacherName: 'Mme Sophie Laurent'
    }
  ];

  return {
    students,
    grades,
    attendances,
    homeworks,
    appointments,
    invoices,
    messages
  };
}

export async function purgeUserData(userId: string): Promise<void> {
  const collectionsToPurge = [
    'grades',
    'attendance',
    'homeworks',
    'appointments',
    'messages',
    'invoices',
    'announcements'
  ];

  // 1. First find student IDs and purge child reading logs while student records exist
  try {
    const studentQuery = query(collection(db, 'students'), where('parentId', '==', userId));
    const studentSnap = await getDocs(studentQuery);
    const studentIds: string[] = [];
    studentSnap.forEach(s => studentIds.push(s.id));

    if (studentIds.length > 0) {
      for (const sId of studentIds) {
        try {
          const rlQuery = query(collection(db, 'reading_logs'), where('studentId', '==', sId));
          const rlSnap = await getDocs(rlQuery);
          if (!rlSnap.empty) {
            const batch = writeBatch(db);
            rlSnap.forEach(docSnap => batch.delete(docSnap.ref));
            await batch.commit();
            console.log(`[Pasma-sys Purger] Successfully purged reading_logs for student ${sId}`);
          }
        } catch (subErr) {
          console.warn(`[Pasma-sys Purger] Error purging reading_logs for student ${sId}:`, subErr);
        }
      }
    }
  } catch (err) {
    console.warn("[Pasma-sys Purger] Error gathering students for reading_logs purge:", err);
  }

  // 2. Next, delete all entries matching parentId on major collections
  for (const coll of collectionsToPurge) {
    try {
      const q = query(collection(db, coll), where('parentId', '==', userId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
        console.log(`[Pasma-sys Purger] Successfully purged collection: ${coll}`);
      }
    } catch (err) {
      console.warn(`[Pasma-sys Purger] Error purging collection ${coll}:`, err);
    }
  }

  // 3. Finally delete the students themselves
  try {
    const q = query(collection(db, 'students'), where('parentId', '==', userId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      console.log(`[Pasma-sys Purger] Successfully purged students collection.`);
    }
  } catch (err) {
    console.warn(`[Pasma-sys Purger] Error purging students collection:`, err);
  }
}

