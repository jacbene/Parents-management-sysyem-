import { collection, doc, setDoc, deleteDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ApeeParent, ApeeExpense, ApeeSettings, Invoice, ApeeActivityLog } from '../types';

// Base cache keys
const CACHE_SETTINGS = 'apee_settings_cache';
const CACHE_PARENTS = 'apee_parents_cache';
const CACHE_EXPENSES = 'apee_expenses_cache';
const CACHE_LOGS = 'apee_logs_cache';

// Load default settings if none exist
export const DEFAULT_SETTINGS: ApeeSettings = {
  associationName: "APEE CES d'Ekali 1 - MFOU",
  schoolYear: '2025/2026',
  cotisationAmount: 25000,
  financialGoal: 5000000,
  budgetLines: [
    { id: 'bl_1', name: 'Soutien Pédagogique et Matériel Didactique', allocatedAmount: 1500000, description: 'Achat de craies, livres, cahiers de préparation, et soutien aux enseignants vacataires' },
    { id: 'bl_2', name: 'Aménagement et Réparations des Salles', allocatedAmount: 1200000, description: 'Réparation des tables-bancs, entretien des toitures et peinture' },
    { id: 'bl_3', name: 'Fournitures de Bureau et Administration', allocatedAmount: 850000, description: 'Rames de papier, encre d\'imprimante, frais administratifs' },
    { id: 'bl_4', name: 'Santé, Hygiène et Eau potable', allocatedAmount: 650000, description: 'Boîte à pharmacie d\'urgence, eau potable, entretien des sanitaires' },
    { id: 'bl_5', name: 'Activités Post et Périscolaires (FENASSCO)', allocatedAmount: 800000, description: 'Fêtes scolaires, compétitions sportives et récompenses de fin d\'année' }
  ],
  finManagerName: '',
  finManagerPhone: '',
  finManagerPassword: '',
  pedManagerName: '',
  pedManagerPhone: '',
  pedManagerPassword: ''
};

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
  return {
    id: parent.id,
    studentId: 'apee_ces_ekali_1', // Marker for parent cotisation
    parentId,
    title: parent.name,
    amount: parent.totalDue,
    dueDate: parent.createdAt || new Date().toISOString(),
    status: parent.status === 'soldé' ? 'Paid' : 'Unpaid',
    paymentDate: parent.updatedAt || new Date().toISOString(),
    phone: parent.phone,
    address: parent.address,
    email: parent.email || '',
    lastReminded: parent.lastReminded || '',
    note: parent.note,
    amountPaid: parent.totalPaid,
    studentsList: JSON.stringify(parent.students),
    paymentsHistory: JSON.stringify(parent.payments),
    transactionId: lastPayment?.transactionId || '',
    provider: lastPayment?.provider || '',
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
 * Loads entire workspace data, matching with offline storage cache
 */
export async function fetchApeeData(parentId: string) {
  // 1. Get offline cache values first for instant loading (PWA)
  let cachedSettings: ApeeSettings = DEFAULT_SETTINGS;
  let cachedParents: ApeeParent[] = [];
  let cachedExpenses: ApeeExpense[] = [];
  let cachedLogs: ApeeActivityLog[] = [];

  try {
    const s = localStorage.getItem(`${CACHE_SETTINGS}_${parentId}`);
    if (s) cachedSettings = JSON.parse(s);

    const p = localStorage.getItem(`${CACHE_PARENTS}_${parentId}`);
    if (p) cachedParents = JSON.parse(p);

    const e = localStorage.getItem(`${CACHE_EXPENSES}_${parentId}`);
    if (e) cachedExpenses = JSON.parse(e);

    const l = localStorage.getItem(`${CACHE_LOGS}_${parentId}`);
    if (l) cachedLogs = JSON.parse(l);
  } catch (err) {
    console.error('LocalStorage load failed', err);
  }

  // If parentId is missing (not authenticated yet), return cache fallback
  if (!parentId) {
    return { settings: cachedSettings, parents: cachedParents, expenses: cachedExpenses, logs: cachedLogs };
  }

  try {
    // Read from Firestore invoices collection for this parentId
    const qInvoices = query(collection(db, 'invoices'), where('parentId', '==', parentId));
    const snapshot = await getDocs(qInvoices);
    
    const dbParents: ApeeParent[] = [];
    const dbExpenses: ApeeExpense[] = [];
    const dbLogs: ApeeActivityLog[] = [];
    let dbSettings: ApeeSettings | null = null;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Invoice;
      if (data.studentId === 'apee_ces_ekali_1') {
        dbParents.push(normalizeToApeeParent(data));
      } else if (data.studentId === 'apee_expense') {
        dbExpenses.push(normalizeToApeeExpense(data));
      } else if (data.studentId === 'apee_log') {
        dbLogs.push(normalizeToApeeLog(data));
      } else if (data.id === 'apee_settings') {
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
        };
      }
    });

    // Merge/overwrite cache if data is fetched
    const finalSettings = dbSettings || cachedSettings;
    const finalParents = dbParents.length > 0 ? dbParents : cachedParents;
    const finalExpenses = dbExpenses.length > 0 ? dbExpenses : cachedExpenses;
    const finalLogs = dbLogs.length > 0 ? dbLogs : cachedLogs;
    finalLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Automatic self-healing: copy local-only parents back to Firestore
    if (parentId && dbParents.length === 0 && cachedParents.length > 0) {
      console.log("Rescuing local-only parents and syncing them to Firestore...");
      cachedParents.forEach(async (cp) => {
        try {
          const invData = normalizeToInvoice(cp, parentId);
          await setDoc(doc(db, 'invoices', cp.id), invData);
        } catch (e) {
          console.error("Auto background sync failed for parent", cp.name, e);
        }
      });
    }

    if (parentId && dbParents.length > 0 && cachedParents.length > dbParents.length) {
      cachedParents.forEach(async (cp) => {
        if (!dbParents.some(dp => dp.id === cp.id)) {
          console.log("Rescuing newly-added offline parent:", cp.name);
          try {
            const invData = normalizeToInvoice(cp, parentId);
            await setDoc(doc(db, 'invoices', cp.id), invData);
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

    return {
      settings: finalSettings,
      parents: finalParents,
      expenses: finalExpenses,
      logs: finalLogs,
    };
  } catch (err) {
    console.warn('Firestore fetch failed, staying offline/local first mode because of', err);
    return { settings: cachedSettings, parents: cachedParents, expenses: cachedExpenses, logs: cachedLogs };
  }
}

/**
 * Save Apee Settings
 */
export async function saveApeeSettings(parentId: string, settings: ApeeSettings) {
  localStorage.setItem(`${CACHE_SETTINGS}_${parentId}`, JSON.stringify(settings));

  if (!parentId) return;

  try {
    await setDoc(doc(db, 'invoices', `${parentId}_settings`), {
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
    });
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

  try {
    const invoiceData = normalizeToInvoice(parent, parentId);
    await setDoc(doc(db, 'invoices', parent.id), invoiceData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invoices/${parent.id}`);
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

  try {
    await deleteDoc(doc(db, 'invoices', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `invoices/${id}`);
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

  try {
    const invoiceData = normalizeExpenseToInvoice(expense, parentId);
    await setDoc(doc(db, 'invoices', expense.id), invoiceData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invoices/${expense.id}`);
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

  try {
    await deleteDoc(doc(db, 'invoices', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `invoices/${id}`);
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

  try {
    const invoiceData = normalizeLogToInvoice(log, parentId);
    await setDoc(doc(db, 'invoices', log.id), invoiceData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invoices/${log.id}`);
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
      batch.set(doc(db, 'invoices', p.id), parentInvoice);
    });

    // Write expenses
    finalExpenses.forEach((exp) => {
      const expInvoice = normalizeExpenseToInvoice(exp, parentId);
      batch.set(doc(db, 'invoices', exp.id), expInvoice);
    });

    // Write logs
    finalLogs.forEach((log) => {
      const logInvoice = normalizeLogToInvoice(log, parentId);
      batch.set(doc(db, 'invoices', log.id), logInvoice);
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
