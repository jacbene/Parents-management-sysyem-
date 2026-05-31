import { collection, doc, writeBatch, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Student, Grade, Attendance, Homework, Appointment, Message, Invoice } from './types';

export async function isDatabaseSeeded(userId: string): Promise<boolean> {
  const q = query(collection(db, 'students'), where('parentId', '==', userId));
  try {
    const snapshot = await Promise.race([
      getDocs(q),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout checking seeded state')), 2500))
    ]);
    return !snapshot.empty;
  } catch (err) {
    console.warn("isDatabaseSeeded: Firestore offline or timed out, assuming true to prevent remote write locks in local preview:", err);
    return true;
  }
}

export async function seedUserData(userId: string): Promise<void> {
  try {
    const batch = writeBatch(db);

    // 1. Students
    const student1Id = `stu_lucas_${userId.slice(0, 6)}`;
    const student2Id = `stu_chloe_${userId.slice(0, 6)}`;

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

    batch.set(doc(db, 'students', student1Id), student1);
    batch.set(doc(db, 'students', student2Id), student2);

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
      }
    ];

    grades.forEach(g => {
      batch.set(doc(db, 'grades', g.id), g);
    });

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
      }
    ];

    attendances.forEach(a => {
      batch.set(doc(db, 'attendance', a.id), a);
    });

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
      }
    ];

    homeworks.forEach(hw => {
      batch.set(doc(db, 'homeworks', hw.id), hw);
    });

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
      }
    ];

    appointments.forEach(apt => {
      batch.set(doc(db, 'appointments', apt.id), apt);
    });

    // 6. Invoices (Facturation)
    const invoices: Invoice[] = [
      {
        id: `inv_1_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        title: 'Cantine Scolaire - Mai 2026',
        amount: 54.00,
        dueDate: '2026-06-05',
        status: 'Unpaid'
      },
      {
        id: `inv_2_${userId.slice(0, 6)}`,
        studentId: student2Id,
        parentId: userId,
        title: 'Abonnement Transport Scolaire - Trimestre 3',
        amount: 110.00,
        dueDate: '2026-06-10',
        status: 'Unpaid'
      },
      {
        id: `inv_3_${userId.slice(0, 6)}`,
        studentId: student1Id,
        parentId: userId,
        title: 'Matériel pédagogique & Fournitures - Trimestre 2',
        amount: 35.00,
        dueDate: '2026-03-15',
        status: 'Paid',
        paymentDate: '2026-03-10'
      }
    ];

    invoices.forEach(inv => {
      batch.set(doc(db, 'invoices', inv.id), inv);
    });

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
      }
    ];

    messages.forEach(msg => {
      batch.set(doc(db, 'messages', msg.id), msg);
    });

    await batch.commit();
    console.log('Seeding of Parents Management System (Pasma-sys) ended successfully!');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seeding');
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
      id: `inv_1_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      title: 'Cantine Scolaire - Mai 2026',
      amount: 54.00,
      dueDate: '2026-06-05',
      status: 'Unpaid'
    },
    {
      id: `inv_2_${userId.slice(0, 6)}`,
      studentId: student2Id,
      parentId: userId,
      title: 'Abonnement Transport Scolaire - Trimestre 3',
      amount: 110.00,
      dueDate: '2026-06-10',
      status: 'Unpaid'
    },
    {
      id: `inv_3_${userId.slice(0, 6)}`,
      studentId: student1Id,
      parentId: userId,
      title: 'Matériel pédagogique & Fournitures - Trimestre 2',
      amount: 35.00,
      dueDate: '2026-03-15',
      status: 'Paid',
      paymentDate: '2026-03-10'
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
