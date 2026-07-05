import { collection, doc, setDoc, deleteDoc, getDocs, query, where, writeBatch, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, isOffline, queuePendingAction } from '../firebase';
import { ApeeParent, ApeeExpense, ApeeSettings, Invoice, ApeeActivityLog, ApeeOtherRevenue } from '../types';

// Base cache keys
const CACHE_SETTINGS = 'apee_settings_cache';
const CACHE_PARENTS = 'apee_parents_cache';
const CACHE_EXPENSES = 'apee_expenses_cache';
const CACHE_LOGS = 'apee_logs_cache';
const CACHE_OTHER_REVENUES = 'apee_other_revenues_cache';

// Load default settings if none exist
export const DEFAULT_SETTINGS: ApeeSettings = {
  associationName: "APEE CES d'Ekali 1 - MFOU",
  schoolYear: '2025/2026',
  cotisationAmount: 12500,
  financialGoal: 2750000,
  honoraryContributions: 500000,
  subventionsAndAids: 1000000,
  actualHonoraryContributions: 0,
  actualSubventionsAndAids: 0,
  country: 'Cameroun',
  currency: 'FCFA',
  financialObligations: [
    { id: 'obl_apee', name: 'Cotisation APEE', amount: 12500, type: 'per_student', description: 'Cotisation de l\'association des parents d\'élèves' },
    { id: 'obl_inscription', name: 'Frais d\'inscription', amount: 5000, type: 'per_student', description: 'Droits d\'entrée scolaires réglementaires' },
    { id: 'obl_pension', name: 'Pension scolaire', amount: 25000, type: 'per_student', description: 'Frais de scolarité obligatoires' },
    { id: 'obl_cantine', name: 'Cantine scolaire', amount: 15000, type: 'per_student', description: 'Service de restauration midi' },
    { id: 'obl_transport', name: 'Transport scolaire', amount: 10000, type: 'per_student', description: 'Abonnement bus scolaire' },
    { id: 'obl_secours', name: 'Fonds d\'urgence APEE', amount: 2000, type: 'per_parent', description: 'Contribution de solidarité parentale' }
  ],
  budgetLines: [
    { id: 'bl_1', name: 'Soutien Pédagogique et Matériel Didactique', allocatedAmount: 900000, description: 'Achat de craies, livres, cahiers de préparation, et soutien aux enseignants vacataires' },
    { id: 'bl_2', name: 'Aménagement et Réparations des Salles', allocatedAmount: 650000, description: 'Réparation des tables-bancs, entretien des toitures et peinture' },
    { id: 'bl_3', name: 'Fournitures de Bureau et Administration', allocatedAmount: 450000, description: 'Rames de papier, encre d\'imprimante, frais administratifs' },
    { id: 'bl_4', name: 'Santé, Hygiène et Eau potable', allocatedAmount: 350000, description: 'Boîte à pharmacie d\'urgence, eau potable, entretien des sanitaires' },
    { id: 'bl_5', name: 'Activités Post et Périscolaires (FENASSCO)', allocatedAmount: 400000, description: 'Fêtes scolaires, compétitions sportives et récompenses de fin d\'année' }
  ],
  finManagerName: '',
  finManagerPhone: '',
  finManagerPassword: '',
  pedManagerName: '',
  pedManagerPhone: '',
  pedManagerPassword: ''
};

/**
 * Dynamically computes or retrieves the short name of the institution/association in French- Cameroon context.
 */
export function getApeeShortName(settings?: { associationName?: string; shortName?: string }): string {
  if (settings?.shortName && settings.shortName.trim()) {
    return settings.shortName.trim();
  }
  const name = settings?.associationName || '';
  if (!name.trim()) return "APEE";

  // Stop words to remove from acronym generation
  const stopWords = ['de', 'du', 'la', 'le', 'les', 'des', 'et', 'en', 'dans', 'pour', 'par', 'sur', 'aux', 'au', 'un', 'une', 'd', 'l', 's', 'c', 'j'];
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(w => {
    const lw = w.toLowerCase();
    return lw.length > 0 && !stopWords.includes(lw);
  });

  if (words.length === 0) return "APEE";

  // If the first word is already APEE or similar acronym, or if words has initials
  const initials = words.map(w => w[0].toUpperCase()).join('');
  return initials.substring(0, 15) || "APEE";
}

/**
 * Ensures document IDs are unique per parent/tenant to prevent Firestore permission and collision issues
 */
function getScopedApeeDocId(id: string, parentId: string): string {
  if (!id) return id;
  if (!parentId) return id;
  if (id.includes(parentId) || id === 'apee_settings' || id.startsWith(parentId)) {
    return id;
  }
  return `${id}_${parentId}`;
}

/**
 * Normalizes Firestore Invoice document to ApeeParent
 */
function normalizeToApeeParent(inv: Invoice): ApeeParent {
  let students = [];
  try {
    if (inv.studentsList) {
      students = JSON.parse(inv.studentsList);
    }
  } catch (e) {
    console.error('Error parsing students list', e);
  }

  let payments = [];
  try {
    if (inv.paymentsHistory) {
      payments = JSON.parse(inv.paymentsHistory);
    }
  } catch (e) {
    console.error('Error parsing payments history', e);
  }

  return {
    id: inv.id,
    name: inv.title,
    phone: inv.phone || '',
    address: inv.address || '',
    email: inv.email || '',
    lastReminded: inv.lastReminded || '',
    students,
    totalDue: inv.amount,
    totalPaid: inv.amountPaid || 0,
    status: (inv.status === 'Paid' ? 'soldé' : (inv.amountPaid && inv.amountPaid > 0 ? 'partiel' : 'retard')) as 'soldé' | 'partiel' | 'retard',
    note: inv.note || '',
    payments,
    createdAt: inv.dueDate || new Date().toISOString(), // reuses dueDate as metadata
    updatedAt: inv.paymentDate || new Date().toISOString(),
  };
}

/**
 * Normalizes ApeeParent to Firestore Invoice shape
 */
function normalizeToInvoice(parent: ApeeParent, parentId: string): Invoice {
  const lastPayment = parent.payments && parent.payments.length > 0 ? parent.payments[parent.payments.length - 1] : null;
  const name = parent.name || (parent as any).title || '';
  const amount = parent.totalDue !== undefined ? parent.totalDue : ((parent as any).amount !== undefined ? (parent as any).amount : 0);
  const amountPaid = parent.totalPaid !== undefined ? parent.totalPaid : ((parent as any).amountPaid !== undefined ? (parent as any).amountPaid : 0);
  const dueDate = parent.createdAt || (parent as any).dueDate || new Date().toISOString();
  const paymentDate = parent.updatedAt || (parent as any).paymentDate || new Date().toISOString();
  const status = parent.status === 'soldé' || (parent as any).status === 'Paid' ? 'Paid' : 'Unpaid';
  
  return {
    id: parent.id,
    studentId: 'apee_ces_ekali_1', // Marker for parent cotisation
    parentId,
    title: name,
    amount,
    dueDate,
    status,
    paymentDate,
    phone: parent.phone,
    address: parent.address || '',
    email: parent.email || '',
    lastReminded: parent.lastReminded || '',
    note: parent.note || '',
    amountPaid,
    studentsList: parent.students ? JSON.stringify(parent.students) : ((parent as any).studentsList || '[]'),
    paymentsHistory: parent.payments ? JSON.stringify(parent.payments) : ((parent as any).paymentsHistory || '[]'),
    transactionId: lastPayment?.transactionId || (parent as any).transactionId || '',
    provider: lastPayment?.provider || (parent as any).provider || '',
  };
}

/**
 * Normalizes Expense to Invoice document
 */
function normalizeExpenseToInvoice(exp: ApeeExpense, parentId: string): Invoice {
  return {
    id: exp.id,
    studentId: 'apee_expense', // Marker for expenses
    parentId,
    title: exp.title,
    amount: exp.amount,
    dueDate: exp.type, // commands / payments / refunds
    status: exp.status === 'Executed' ? 'Paid' : 'Unpaid',
    paymentDate: exp.date,
    expenseType: exp.type,
    description: exp.description,
    budgetLineId: exp.budgetLineId || '',
  };
}

/**
 * Normalizes Invoice to Expense
 */
function normalizeToApeeExpense(inv: Invoice): ApeeExpense {
  return {
    id: inv.id,
    type: (inv.expenseType || inv.dueDate) as 'command' | 'payment-order' | 'refund',
    title: inv.title,
    amount: inv.amount,
    status: (inv.status === 'Paid' ? 'Executed' : 'Pending') as 'Pending' | 'Approved' | 'Executed',
    date: inv.paymentDate || new Date().toISOString().slice(0, 10),
    description: inv.description || '',
    budgetLineId: inv.budgetLineId || '',
  };
}

/**
 * Normalizes ApeeActivityLog to Firestore Invoice shape
 */
function normalizeLogToInvoice(log: ApeeActivityLog, parentId: string): Invoice {
  return {
    id: log.id,
    studentId: 'apee_log',
    parentId,
    title: log.parentName,
    amount: log.amount,
    dueDate: log.actionType,
    status: 'Paid',
    paymentDate: log.timestamp,
    provider: log.operatorName,
    note: log.description,
  };
}

/**
 * Normalizes Firestore Invoice shape to ApeeActivityLog
 */
function normalizeToApeeLog(inv: Invoice): ApeeActivityLog {
  return {
    id: inv.id,
    parentId: inv.parentId,
    timestamp: inv.paymentDate || new Date().toISOString(),
    parentName: inv.title || '',
    actionType: (inv.dueDate || 'MANUAL_ENTRY') as any,
    description: inv.note || '',
    amount: inv.amount || 0,
    operatorName: inv.provider || 'Gérant de Caisse',
  };
}

/**
 * Normalizes Firestore Invoice shape to ApeeOtherRevenue
 */
function normalizeToOtherRevenue(inv: Invoice): ApeeOtherRevenue {
  return {
    id: inv.id,
    payerName: inv.title || '',
    status: (inv.address || 'autre') as 'membre_honneur' | 'institution' | 'autre',
    statusDetails: inv.phone || '',
    amount: inv.amount || 0,
    paymentMethod: inv.provider || 'Espèces',
    date: inv.dueDate || new Date().toISOString().slice(0, 10),
    transactionId: inv.transactionId || '',
    notes: inv.note || '',
    createdAt: inv.paymentDate || new Date().toISOString(),
  };
}

/**
 * Normalizes ApeeOtherRevenue to Firestore Invoice shape
 */
function normalizeOtherRevenueToInvoice(rev: ApeeOtherRevenue, parentId: string): Invoice {
  return {
    id: rev.id,
    studentId: 'apee_other_revenue',
    parentId,
    title: rev.payerName,
    amount: rev.amount,
    dueDate: rev.date,
    status: 'Paid',
    paymentDate: rev.createdAt || new Date().toISOString(),
    address: rev.status,
    phone: rev.statusDetails || '',
    provider: rev.paymentMethod,
    transactionId: rev.transactionId || '',
    note: rev.notes || '',
  };
}

/**
 * Loads entire workspace data, matching with offline storage cache
 */
export async function fetchApeeData(parentId: string) {
  // 1. Get offline cache values first for instant loading (PWA)
  let cachedSettings: ApeeSettings = DEFAULT_SETTINGS;
  let cachedParents: ApeeParent[] = [];
  let cachedExpenses: ApeeExpense[] = [];
  let cachedLogs: ApeeActivityLog[] = [];
  let cachedOtherRevenues: ApeeOtherRevenue[] = [];

  try {
    const s = localStorage.getItem(`${CACHE_SETTINGS}_${parentId}`);
    if (s) cachedSettings = JSON.parse(s);

    const p = localStorage.getItem(`${CACHE_PARENTS}_${parentId}`);
    if (p) cachedParents = JSON.parse(p);

    const e = localStorage.getItem(`${CACHE_EXPENSES}_${parentId}`);
    if (e) cachedExpenses = JSON.parse(e);

    const l = localStorage.getItem(`${CACHE_LOGS}_${parentId}`);
    if (l) cachedLogs = JSON.parse(l);

    const r = localStorage.getItem(`${CACHE_OTHER_REVENUES}_${parentId}`);
    if (r) cachedOtherRevenues = JSON.parse(r);
  } catch (err) {
    console.error('LocalStorage load failed', err);
  }

  // If parentId is missing (not authenticated yet), return cache fallback
  if (!parentId) {
    return { 
      settings: cachedSettings, 
      parents: cachedParents, 
      expenses: cachedExpenses, 
      logs: cachedLogs,
      otherRevenues: cachedOtherRevenues 
    };
  }

  try {
    // Read from Firestore invoices collection for this parentId
    const qInvoices = query(collection(db, 'invoices'), where('parentId', '==', parentId));
    const snapshot = await getDocs(qInvoices);
    
    const dbParents: ApeeParent[] = [];
    const dbExpenses: ApeeExpense[] = [];
    const dbLogs: ApeeActivityLog[] = [];
    const dbOtherRevenues: ApeeOtherRevenue[] = [];
    let dbSettings: ApeeSettings | null = null;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Invoice;
      if (data.studentId === 'apee_ces_ekali_1') {
        dbParents.push(normalizeToApeeParent(data));
      } else if (data.studentId === 'apee_expense') {
        dbExpenses.push(normalizeToApeeExpense(data));
      } else if (data.studentId === 'apee_log') {
        dbLogs.push(normalizeToApeeLog(data));
      } else if (data.studentId === 'apee_other_revenue') {
        dbOtherRevenues.push(normalizeToOtherRevenue(data));
      } else if (data.studentId === 'apee_settings') {
        let lines = DEFAULT_SETTINGS.budgetLines;
        try {
          if (data.budgetLinesList) {
            lines = JSON.parse(data.budgetLinesList);
          }
        } catch (e) {
          console.error("Failed to parse budgetLinesList from Firestore", e);
        }
        let teachers = [];
        try {
          if (data.classTeachersList) {
            teachers = JSON.parse(data.classTeachersList);
          }
        } catch (e) {
          console.error("Failed to parse classTeachersList from Firestore", e);
        }
        let obligations = DEFAULT_SETTINGS.financialObligations;
        try {
          if (data.financialObligationsList) {
            obligations = JSON.parse(data.financialObligationsList);
          }
        } catch (e) {
          console.error("Failed to parse financialObligationsList from Firestore", e);
        }
        dbSettings = {
          associationName: data.title,
          cotisationAmount: data.amount,
          schoolYear: data.dueDate,
          financialGoal: data.amountPaid || DEFAULT_SETTINGS.financialGoal,
          budgetLines: lines,
          finManagerName: data.finManagerName || '',
          finManagerPhone: data.finManagerPhone || '',
          finManagerPassword: data.finManagerPassword || '',
          pedManagerName: data.pedManagerName || '',
          pedManagerPhone: data.pedManagerPhone || '',
          pedManagerPassword: data.pedManagerPassword || '',
          logoUrl: data.logoUrl || '',
          directorName: data.directorName || '',
          directorPhone: data.directorPhone || '',
          directorEmail: data.directorEmail || '',
          surveillantName: data.surveillantName || '',
          surveillantPhone: data.surveillantPhone || '',
          censeurName: data.censeurName || '',
          censeurPhone: data.censeurPhone || '',
          classTeachers: teachers,
          honoraryContributions: data.honoraryContributions || 0,
          subventionsAndAids: data.subventionsAndAids || 0,
          actualHonoraryContributions: data.actualHonoraryContributions || 0,
          actualSubventionsAndAids: data.actualSubventionsAndAids || 0,
          expectedStudents: data.expectedStudents || 100,
          country: data.country || DEFAULT_SETTINGS.country,
          currency: data.currency || DEFAULT_SETTINGS.currency,
          financialObligations: obligations,
        };
      }
    });

    // Merge/overwrite cache if data is fetched
    const finalSettings = dbSettings || cachedSettings;
    const finalParents = dbParents.length > 0 ? dbParents : cachedParents;
    const finalExpenses = dbExpenses.length > 0 ? dbExpenses : cachedExpenses;
    const finalLogs = dbLogs.length > 0 ? dbLogs : cachedLogs;
    const finalOtherRevenues = dbOtherRevenues.length > 0 ? dbOtherRevenues : cachedOtherRevenues;
    finalLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const currentUser = auth.currentUser;
    const isParentRole = localStorage.getItem('portal_user_role') === 'parent';
    const canSyncToWrite = currentUser && !isParentRole;

    // Automatic self-healing: copy local-only parents back to Firestore
    if (canSyncToWrite && parentId && dbParents.length === 0 && cachedParents.length > 0) {
      console.log("Rescuing local-only parents and syncing them to Firestore...");
      cachedParents.forEach(async (cp) => {
        try {
          const invData = normalizeToInvoice(cp, parentId);
          await setDoc(doc(db, 'invoices', getScopedApeeDocId(cp.id, parentId)), invData);
        } catch (e) {
          console.error("Auto background sync failed for parent", cp.name, e);
        }
      });
    }

    if (canSyncToWrite && parentId && dbParents.length > 0 && cachedParents.length > dbParents.length) {
      cachedParents.forEach(async (cp) => {
        if (!dbParents.some(dp => dp.id === cp.id)) {
          console.log("Rescuing newly-added offline parent:", cp.name);
          try {
            const invData = normalizeToInvoice(cp, parentId);
            await setDoc(doc(db, 'invoices', getScopedApeeDocId(cp.id, parentId)), invData);
          } catch (e) {
            console.error("Auto rescue failed for parent", cp.name, e);
          }
        }
      });
    }

    // Persist again locally
    localStorage.setItem(`${CACHE_SETTINGS}_${parentId}`, JSON.stringify(finalSettings));
    localStorage.setItem(`${CACHE_PARENTS}_${parentId}`, JSON.stringify(finalParents));
    localStorage.setItem(`${CACHE_EXPENSES}_${parentId}`, JSON.stringify(finalExpenses));
    localStorage.setItem(`${CACHE_LOGS}_${parentId}`, JSON.stringify(finalLogs));
    localStorage.setItem(`${CACHE_OTHER_REVENUES}_${parentId}`, JSON.stringify(finalOtherRevenues));

    return {
      settings: finalSettings,
      parents: finalParents,
      expenses: finalExpenses,
      logs: finalLogs,
      otherRevenues: finalOtherRevenues,
    };
  } catch (err) {
    console.warn('Firestore fetch failed, staying offline/local first mode because of', err);
    return { 
      settings: cachedSettings, 
      parents: cachedParents, 
      expenses: cachedExpenses, 
      logs: cachedLogs,
      otherRevenues: cachedOtherRevenues
    };
  }
}

/**
 * Save Apee Other Revenue
 */
export async function saveApeeOtherRevenue(parentId: string, revenue: ApeeOtherRevenue) {
  try {
    const s = localStorage.getItem(`${CACHE_OTHER_REVENUES}_${parentId}`);
    let revenues: ApeeOtherRevenue[] = s ? JSON.parse(s) : [];
    const index = revenues.findIndex((r) => r.id === revenue.id);
    if (index !== -1) {
      revenues[index] = revenue;
    } else {
      revenues.push(revenue);
    }
    localStorage.setItem(`${CACHE_OTHER_REVENUES}_${parentId}`, JSON.stringify(revenues));
  } catch (e) {
    console.error(e);
  }

  if (!parentId) return;

  const invoiceData = normalizeOtherRevenueToInvoice(revenue, parentId);

  const scopedId = getScopedApeeDocId(revenue.id, parentId);

  if (isOffline()) {
    queuePendingAction('UPDATE', 'invoices', scopedId, `Enregistrer autre recette de ${revenue.payerName} (${revenue.amount} FCFA)`, invoiceData);
    return;
  }

  try {
    await setDoc(doc(db, 'invoices', scopedId), invoiceData);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pasma_save_success', { detail: { title: `Enregistrer autre recette de ${revenue.payerName} (${revenue.amount} FCFA)` } }));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invoices/${scopedId}`);
  }
}

/**
 * Delete Apee Other Revenue
 */
export async function deleteApeeOtherRevenue(parentId: string, id: string) {
  try {
    const s = localStorage.getItem(`${CACHE_OTHER_REVENUES}_${parentId}`);
    if (s) {
      let revenues: ApeeOtherRevenue[] = JSON.parse(s);
      revenues = revenues.filter((r) => r.id !== id);
      localStorage.setItem(`${CACHE_OTHER_REVENUES}_${parentId}`, JSON.stringify(revenues));
    }
  } catch (e) {
    console.error(e);
  }

  if (!parentId) return;

  const scopedId = getScopedApeeDocId(id, parentId);

  if (isOffline()) {
    queuePendingAction('DELETE', 'invoices', scopedId, `Supprimer autre recette : ${id}`);
    return;
  }

  try {
    await deleteDoc(doc(db, 'invoices', scopedId));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pasma_save_success', { detail: { title: `Supprimer autre recette` } }));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `invoices/${scopedId}`);
  }
}

/**
 * Save Apee Settings
 */
export async function saveApeeSettings(parentId: string, settings: ApeeSettings) {
  localStorage.setItem(`${CACHE_SETTINGS}_${parentId}`, JSON.stringify(settings));

  if (!parentId) return;

  const settingsInvoice = {
    id: 'apee_settings',
    studentId: 'apee_settings',
    parentId,
    title: settings.associationName,
    amount: settings.cotisationAmount,
    dueDate: settings.schoolYear,
    status: 'Paid',
    amountPaid: settings.financialGoal,
    budgetLinesList: JSON.stringify(settings.budgetLines || []),
    finManagerName: settings.finManagerName || '',
    finManagerPhone: settings.finManagerPhone || '',
    finManagerPassword: settings.finManagerPassword || '',
    pedManagerName: settings.pedManagerName || '',
    pedManagerPhone: settings.pedManagerPhone || '',
    pedManagerPassword: settings.pedManagerPassword || '',
    logoUrl: settings.logoUrl || '',
    directorName: settings.directorName || '',
    directorPhone: settings.directorPhone || '',
    directorEmail: settings.directorEmail || '',
    surveillantName: settings.surveillantName || '',
    surveillantPhone: settings.surveillantPhone || '',
    censeurName: settings.censeurName || '',
    censeurPhone: settings.censeurPhone || '',
    classTeachersList: JSON.stringify(settings.classTeachers || []),
    honoraryContributions: settings.honoraryContributions || 0,
    subventionsAndAids: settings.subventionsAndAids || 0,
    actualHonoraryContributions: settings.actualHonoraryContributions || 0,
    actualSubventionsAndAids: settings.actualSubventionsAndAids || 0,
    expectedStudents: settings.expectedStudents || 100,
    country: settings.country || '',
    currency: settings.currency || '',
    financialObligationsList: JSON.stringify(settings.financialObligations || []),
  };

  if (isOffline()) {
    queuePendingAction('UPDATE', 'invoices', `${parentId}_settings`, `Ajuster les paramètres APEE : ${settings.associationName}`, settingsInvoice);
    return;
  }

  try {
    await setDoc(doc(db, 'invoices', `${parentId}_settings`), settingsInvoice);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pasma_save_success', { detail: { title: `Ajuster les paramètres APEE : ${settings.associationName}` } }));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invoices/${parentId}_settings`);
  }
}

/**
 * Save Apee Parent registration
 */
export async function saveApeeParent(parentId: string, parent: ApeeParent) {
  // Update local storage cache
  try {
    const s = localStorage.getItem(`${CACHE_PARENTS}_${parentId}`);
    let parents: ApeeParent[] = s ? JSON.parse(s) : [];
    const index = parents.findIndex((p) => p.id === parent.id);
    if (index !== -1) {
      parents[index] = parent;
    } else {
      parents.push(parent);
    }
    localStorage.setItem(`${CACHE_PARENTS}_${parentId}`, JSON.stringify(parents));
  } catch (e) {
    console.error(e);
  }

  if (!parentId) return;

  const invoiceData = normalizeToInvoice(parent, parentId);
  const scopedId = getScopedApeeDocId(parent.id, parentId);

  if (isOffline()) {
    queuePendingAction('UPDATE', 'invoices', scopedId, `Enregistrer le parent : ${parent.name}`, invoiceData);
    return;
  }

  try {
    await setDoc(doc(db, 'invoices', scopedId), invoiceData);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pasma_save_success', { detail: { title: `Enregistrer le parent : ${parent.name}` } }));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invoices/${scopedId}`);
  }
}

/**
 * Delete Parent Record
 */
export async function deleteApeeParent(parentId: string, id: string) {
  try {
    const s = localStorage.getItem(`${CACHE_PARENTS}_${parentId}`);
    if (s) {
      let parents: ApeeParent[] = JSON.parse(s);
      parents = parents.filter((p) => p.id !== id);
      localStorage.setItem(`${CACHE_PARENTS}_${parentId}`, JSON.stringify(parents));
    }
  } catch (e) {
    console.error(e);
  }

  if (!parentId) return;

  const scopedId = getScopedApeeDocId(id, parentId);

  if (isOffline()) {
    queuePendingAction('DELETE', 'invoices', scopedId, `Supprimer le parent : ${id}`);
    return;
  }

  try {
    await deleteDoc(doc(db, 'invoices', scopedId));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pasma_save_success', { detail: { title: `Supprimer le parent : ${id}` } }));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `invoices/${scopedId}`);
  }
}

/**
 * Save Financial Expense
 */
export async function saveApeeExpense(parentId: string, expense: ApeeExpense) {
  try {
    const s = localStorage.getItem(`${CACHE_EXPENSES}_${parentId}`);
    let expenses: ApeeExpense[] = s ? JSON.parse(s) : [];
    const index = expenses.findIndex((e) => e.id === expense.id);
    if (index !== -1) {
      expenses[index] = expense;
    } else {
      expenses.push(expense);
    }
    localStorage.setItem(`${CACHE_EXPENSES}_${parentId}`, JSON.stringify(expenses));
  } catch (e) {
    console.error(e);
  }

  if (!parentId) return;

  const invoiceData = normalizeExpenseToInvoice(expense, parentId);
  const scopedId = getScopedApeeDocId(expense.id, parentId);

  if (isOffline()) {
    queuePendingAction('UPDATE', 'invoices', scopedId, `Enregistrer la dépense : ${expense.title}`, invoiceData);
    return;
  }

  try {
    await setDoc(doc(db, 'invoices', scopedId), invoiceData);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pasma_save_success', { detail: { title: `Enregistrer la dépense : ${expense.title}` } }));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invoices/${scopedId}`);
  }
}

/**
 * Delete Financial Expense
 */
export async function deleteApeeExpense(parentId: string, id: string) {
  try {
    const s = localStorage.getItem(`${CACHE_EXPENSES}_${parentId}`);
    if (s) {
      let expenses: ApeeExpense[] = JSON.parse(s);
      expenses = expenses.filter((e) => e.id !== id);
      localStorage.setItem(`${CACHE_EXPENSES}_${parentId}`, JSON.stringify(expenses));
    }
  } catch (e) {
    console.error(e);
  }

  if (!parentId) return;

  const scopedId = getScopedApeeDocId(id, parentId);

  if (isOffline()) {
    queuePendingAction('DELETE', 'invoices', scopedId, `Supprimer la dépense : ${id}`);
    return;
  }

  try {
    await deleteDoc(doc(db, 'invoices', scopedId));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pasma_save_success', { detail: { title: `Supprimer la dépense : ${id}` } }));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `invoices/${scopedId}`);
  }
}

/**
 * Save Apee Activity log in Firestore and Local Cache
 */
export async function saveApeeLog(parentId: string, log: ApeeActivityLog) {
  try {
    const s = localStorage.getItem(`${CACHE_LOGS}_${parentId}`);
    let logs: ApeeActivityLog[] = s ? JSON.parse(s) : [];
    
    // De-duplicate if ID already exists, or append
    const index = logs.findIndex((l) => l.id === log.id);
    if (index !== -1) {
      logs[index] = log;
    } else {
      logs.push(log);
    }
    
    // Sort descending by timestamp
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    localStorage.setItem(`${CACHE_LOGS}_${parentId}`, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save log in cache:', e);
  }

  if (!parentId) return;

  const invoiceData = normalizeLogToInvoice(log, parentId);
  const scopedId = getScopedApeeDocId(log.id, parentId);

  if (isOffline()) {
    queuePendingAction('UPDATE', 'invoices', scopedId, `Journaliser : ${log.description}`, invoiceData);
    return;
  }

  try {
    await setDoc(doc(db, 'invoices', scopedId), invoiceData);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pasma_save_success', { detail: { title: `Journaliser : ${log.description}` } }));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invoices/${scopedId}`);
  }
}

/**
 * Import a full JSON backup (overwriting previous contents)
 */
export async function importFullBackup(
  parentId: string,
  data: { parents?: ApeeParent[]; expenses?: ApeeExpense[]; settings?: ApeeSettings; logs?: ApeeActivityLog[] }
) {
  const finalParents = data.parents || [];
  const finalExpenses = data.expenses || [];
  const finalSettings = data.settings || DEFAULT_SETTINGS;
  const finalLogs = data.logs || [];

  localStorage.setItem(`${CACHE_SETTINGS}_${parentId}`, JSON.stringify(finalSettings));
  localStorage.setItem(`${CACHE_PARENTS}_${parentId}`, JSON.stringify(finalParents));
  localStorage.setItem(`${CACHE_EXPENSES}_${parentId}`, JSON.stringify(finalExpenses));
  localStorage.setItem(`${CACHE_LOGS}_${parentId}`, JSON.stringify(finalLogs));

  if (!parentId) return;

  try {
    const batch = writeBatch(db);

    // Write settings
    const settingsDocRef = doc(db, 'invoices', `${parentId}_settings`);
    batch.set(settingsDocRef, {
      id: 'apee_settings',
      studentId: 'apee_settings',
      parentId,
      title: finalSettings.associationName,
      amount: finalSettings.cotisationAmount,
      dueDate: finalSettings.schoolYear,
      status: 'Paid',
      amountPaid: finalSettings.financialGoal,
      budgetLinesList: JSON.stringify(finalSettings.budgetLines || []),
      finManagerName: finalSettings.finManagerName || '',
      finManagerPhone: finalSettings.finManagerPhone || '',
      finManagerPassword: finalSettings.finManagerPassword || '',
      pedManagerName: finalSettings.pedManagerName || '',
      pedManagerPhone: finalSettings.pedManagerPhone || '',
      pedManagerPassword: finalSettings.pedManagerPassword || '',
      honoraryContributions: finalSettings.honoraryContributions || 0,
      subventionsAndAids: finalSettings.subventionsAndAids || 0,
    });

    // Write parents
    finalParents.forEach((p) => {
      const parentInvoice = normalizeToInvoice(p, parentId);
      batch.set(doc(db, 'invoices', getScopedApeeDocId(p.id, parentId)), parentInvoice);
    });

    // Write expenses
    finalExpenses.forEach((exp) => {
      const expInvoice = normalizeExpenseToInvoice(exp, parentId);
      batch.set(doc(db, 'invoices', getScopedApeeDocId(exp.id, parentId)), expInvoice);
    });

    // Write logs
    finalLogs.forEach((log) => {
      const logInvoice = normalizeLogToInvoice(log, parentId);
      batch.set(doc(db, 'invoices', getScopedApeeDocId(log.id, parentId)), logInvoice);
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'import_backup_batch');
  }
}

/**
 * Resets the active workspace
 */
export async function resetApeeData(parentId: string) {
  localStorage.removeItem(`${CACHE_SETTINGS}_${parentId}`);
  localStorage.removeItem(`${CACHE_PARENTS}_${parentId}`);
  localStorage.removeItem(`${CACHE_EXPENSES}_${parentId}`);
  localStorage.removeItem(`${CACHE_LOGS}_${parentId}`);
  localStorage.removeItem(`${CACHE_OTHER_REVENUES}_${parentId}`);

  if (!parentId) return;

  try {
    const q = query(collection(db, 'invoices'), where('parentId', '==', parentId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'reset_apee_data');
  }
}

/**
 * Génère un message de relance pré-formaté (SMS ou E-mail) pour un parent.
 * Retourne le message formaté si le solde restant est supérieur à 0, sinon retourne null.
 */
export function generateApeeReminderMessage(
  parent: ApeeParent,
  settings: ApeeSettings,
  type: 'sms' | 'email',
  customTemplates?: {
    smsTemplate?: string;
    emailTemplate?: string;
    emailSubject?: string;
  }
): { message: string; subject?: string } | null {
  const remaining = parent.totalDue - parent.totalPaid;
  if (remaining <= 0) {
    return null;
  }

  const shortName = getApeeShortName(settings);
  const schoolYear = settings?.schoolYear || "";
  const associationName = settings?.associationName || "Établissement";
  const kidsList = parent.students && parent.students.length > 0 
    ? parent.students.map(s => `${s.name} (${s.classRoom})`).join(', ')
    : "votre enfant";

  const defaultSmsTemplate = "Chers parents. Rappel {short_name} {school_year} de {association_name} pour votre pupille ({student_names}). Le solde restant dû est de {remaining_amount} FCFA. Veuillez régulariser au plus vite par versement ou virement. Merci pour votre collaboration.";
  
  const defaultEmailSubject = "Rappel de Paiement Cotisation {short_name} - {association_name}";

  const defaultEmailTemplate = "Bonjour {parent_name},\n\nNous vous contactons au sujet de la cotisation {short_name} ({school_year}) pour l'établissement {association_name} quant à la scolarisation de votre/vos enfant(s) : {student_names}.\n\nÀ ce jour, votre compte présente un solde restant de {remaining_amount} FCFA (sur un montant exigible de {total_due_amount} FCFA).\n\nNous vous prions de bien vouloir régulariser cette situation auprès de l'intendante.\n\nSi vous avez déjà procédé au versement, veuillez ignorer ce message.\n\nCordialement,\nLe Bureau de la régie de {short_name}\n{association_name}";

  const smsTpl = customTemplates?.smsTemplate || defaultSmsTemplate;
  const emailTpl = customTemplates?.emailTemplate || defaultEmailTemplate;
  const emailSub = customTemplates?.emailSubject || defaultEmailSubject;

  const replacePlaceholders = (text: string) => {
    return text
      .replace(/{parent_name}/g, parent.name)
      .replace(/{association_name}/g, associationName)
      .replace(/{short_name}/g, shortName)
      .replace(/{school_year}/g, schoolYear)
      .replace(/{student_names}/g, kidsList)
      .replace(/{remaining_amount}/g, remaining.toLocaleString())
      .replace(/{total_due_amount}/g, parent.totalDue.toLocaleString());
  };

  if (type === 'sms') {
    return {
      message: replacePlaceholders(smsTpl)
    };
  } else {
    return {
      message: replacePlaceholders(emailTpl),
      subject: replacePlaceholders(emailSub)
    };
  }
}

/**
 * Calcule le détail de la dette par rubrique d'obligation financière pour un parent.
 */
export function calculateParentDebtBreakdown(
  parent: { students?: any[]; payments?: any[] },
  settings: ApeeSettings
) {
  const studentCount = (parent.students || []).filter(s => s && s.name && s.name.trim() !== '').length;
  const obligations = settings.financialObligations || DEFAULT_SETTINGS.financialObligations || [];
  
  // Total paid summing up all payments
  const globalPaid = (parent.payments || []).reduce((sum, p) => sum + p.amount, 0);

  // First pass: calculate total expected for each obligation
  let unallocatedPaid = globalPaid;
  let globalDue = 0;

  const rubricBreakdown = obligations.map(obl => {
    let due = 0;
    if (studentCount > 0) {
      due = obl.type === 'per_student' ? (studentCount * obl.amount) : obl.amount;
    }
    globalDue += due;

    // Distribute paid greedily in sequence of defined obligations
    const paid = Math.min(due, unallocatedPaid);
    unallocatedPaid -= paid;

    return {
      id: obl.id,
      name: obl.name,
      type: obl.type,
      amountPerUnit: obl.amount,
      totalDue: due,
      totalPaid: paid,
      remainingDebt: Math.max(0, due - paid)
    };
  });

  // If there's surplus payment (overpayment), allocate it to the first obligation
  if (unallocatedPaid > 0 && rubricBreakdown.length > 0) {
    rubricBreakdown[0].totalPaid += unallocatedPaid;
    rubricBreakdown[0].remainingDebt = rubricBreakdown[0].totalDue - rubricBreakdown[0].totalPaid;
  }

  const globalDebt = Math.max(0, globalDue - globalPaid);

  return {
    rubricBreakdown,
    globalDue,
    globalPaid,
    globalDebt
  };
}

/**
 * Subscribes to dynamic real-time Firestore APEE updates under a school Parent ID
 */
export function subscribeApeeData(
  parentId: string,
  onUpdate: (data: {
    settings: ApeeSettings;
    parents: ApeeParent[];
    expenses: ApeeExpense[];
    logs: ApeeActivityLog[];
    otherRevenues: ApeeOtherRevenue[];
  }) => void,
  onError?: (err: any) => void
) {
  if (!parentId) return () => {};

  const qInvoices = query(collection(db, 'invoices'), where('parentId', '==', parentId));
  
  return onSnapshot(
    qInvoices,
    (snapshot) => {
      const dbParents: ApeeParent[] = [];
      const dbExpenses: ApeeExpense[] = [];
      const dbLogs: ApeeActivityLog[] = [];
      const dbOtherRevenues: ApeeOtherRevenue[] = [];
      let dbSettings: ApeeSettings | null = null;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Invoice;
        if (data.studentId === 'apee_ces_ekali_1') {
          dbParents.push(normalizeToApeeParent(data));
        } else if (data.studentId === 'apee_expense') {
          dbExpenses.push(normalizeToApeeExpense(data));
        } else if (data.studentId === 'apee_log') {
          dbLogs.push(normalizeToApeeLog(data));
        } else if (data.studentId === 'apee_other_revenue') {
          dbOtherRevenues.push(normalizeToOtherRevenue(data));
        } else if (data.studentId === 'apee_settings') {
          let lines = DEFAULT_SETTINGS.budgetLines;
          try {
            if (data.budgetLinesList) {
              lines = JSON.parse(data.budgetLinesList);
            }
          } catch (e) {
            console.error("Failed to parse budgetLinesList from Firestore", e);
          }
          let teachers = [];
          try {
            if (data.classTeachersList) {
              teachers = JSON.parse(data.classTeachersList);
            }
          } catch (e) {
            console.error("Failed to parse classTeachersList from Firestore", e);
          }
          let obligations = DEFAULT_SETTINGS.financialObligations;
          try {
            if (data.financialObligationsList) {
              obligations = JSON.parse(data.financialObligationsList);
            }
          } catch (e) {
            console.error("Failed to parse financialObligationsList from Firestore", e);
          }
          dbSettings = {
            associationName: data.title,
            cotisationAmount: data.amount,
            schoolYear: data.dueDate,
            financialGoal: data.amountPaid || DEFAULT_SETTINGS.financialGoal,
            budgetLines: lines,
            finManagerName: data.finManagerName || '',
            finManagerPhone: data.finManagerPhone || '',
            finManagerPassword: data.finManagerPassword || '',
            pedManagerName: data.pedManagerName || '',
            pedManagerPhone: data.pedManagerPhone || '',
            pedManagerPassword: data.pedManagerPassword || '',
            logoUrl: data.logoUrl || '',
            directorName: data.directorName || '',
            directorPhone: data.directorPhone || '',
            directorEmail: data.directorEmail || '',
            surveillantName: data.surveillantName || '',
            surveillantPhone: data.surveillantPhone || '',
            censeurName: data.censeurName || '',
            censeurPhone: data.censeurPhone || '',
            classTeachers: teachers,
            financialObligations: obligations,
          } as any;
        }
      });

      // Save to caches
      try {
        if (dbSettings) {
          localStorage.setItem(`${CACHE_SETTINGS}_${parentId}`, JSON.stringify(dbSettings));
        }
        localStorage.setItem(`${CACHE_PARENTS}_${parentId}`, JSON.stringify(dbParents));
        localStorage.setItem(`${CACHE_EXPENSES}_${parentId}`, JSON.stringify(dbExpenses));
        localStorage.setItem(`${CACHE_LOGS}_${parentId}`, JSON.stringify(dbLogs));
        localStorage.setItem(`${CACHE_OTHER_REVENUES}_${parentId}`, JSON.stringify(dbOtherRevenues));
      } catch (err) {
        console.error('LocalStorage write failed in subscription', err);
      }

      onUpdate({
        settings: dbSettings || DEFAULT_SETTINGS,
        parents: dbParents,
        expenses: dbExpenses,
        logs: dbLogs,
        otherRevenues: dbOtherRevenues,
      });
    },
    (err) => {
      console.error("Error in subscribeApeeData onSnapshot:", err);
      if (onError) {
        onError(err);
      } else {
        handleFirestoreError(err, OperationType.GET, 'invoices');
      }
    }
  );
}


