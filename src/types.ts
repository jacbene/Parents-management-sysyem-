export interface Student {
  id: string;
  parentId: string;
  name: string;
  grade: string;
  classRoom: string;
  avatar: string;
  teacherName: string;
  teacherEmail: string;
  dob: string;
  gradesValidated?: boolean;
  attendanceValidated?: boolean;
}

export interface Grade {
  id: string;
  studentId: string;
  parentId: string;
  subject: string;
  examName: string;
  score: number;
  maxScore: number;
  teacherRemarks: string;
  date: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export interface Attendance {
  id: string;
  studentId: string;
  parentId: string;
  date: string;
  status: AttendanceStatus;
  remarks?: string;
}

export type HomeworkStatus = 'Pending' | 'Completed' | 'Overdue';

export interface Homework {
  id: string;
  studentId: string;
  parentId: string;
  subject: string;
  title: string;
  description?: string;
  dueDate: string;
  status: HomeworkStatus;
  grade?: string;
}

export type AnnouncementCategory = 'General' | 'Academic' | 'Event' | 'Urgent';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  date: string;
  author: string;
}

export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export interface Appointment {
  id: string;
  studentId: string;
  parentId: string;
  teacherName: string;
  subject: string;
  dateTime: string;
  status: AppointmentStatus;
  notes?: string;
}

export interface Message {
  id: string;
  studentId: string;
  parentId: string;
  senderType: 'Parent' | 'Teacher';
  content: string;
  timestamp: string;
  teacherName?: string;
}

export type InvoiceStatus = 'Paid' | 'Unpaid' | 'Overdue';

export interface Invoice {
  id: string;
  studentId: string;
  parentId: string;
  title: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  paymentDate?: string;
  // Custom APEE fields stored within Invoice shape
  phone?: string;
  address?: string;
  email?: string;
  lastReminded?: string;
  note?: string;
  amountPaid?: number;
  studentsList?: string; // Serialized JSON list of pupils: {name, classRoom}
  paymentsHistory?: string; // Serialized JSON list of payment items
  transactionId?: string; // For APEE transaction ID filtering
  provider?: string; // For APEE provider tracking (MTN/Orange/Wave)
  expenseType?: string; // For expense records
  description?: string; // Detail description
  budgetLineId?: string; // For expense records budget line reference
  budgetLinesList?: string; // For serialized budget lines list in settings
  finManagerName?: string;
  finManagerPhone?: string;
  finManagerPassword?: string;
  pedManagerName?: string;
  pedManagerPhone?: string;
  pedManagerPassword?: string;
  logoUrl?: string;
  directorName?: string;
  directorPhone?: string;
  directorEmail?: string;
  surveillantName?: string;
  surveillantPhone?: string;
  censeurName?: string;
  censeurPhone?: string;
  classTeachersList?: string;
  honoraryContributions?: number;
  subventionsAndAids?: number;
  actualHonoraryContributions?: number;
  actualSubventionsAndAids?: number;
  expectedStudents?: number;
  country?: string;
  currency?: string;
  financialObligationsList?: string;
}

export interface ApeeStudentLink {
  name: string;
  classRoom: string;
  dob?: string;
  dateOperation?: string;
}

export interface ApeePaymentItem {
  id: string;
  amount: number;
  date: string;
  note?: string;
  method?: string;
  transactionId?: string;
  provider?: string;
  allocations?: { [obligationId: string]: number };
}

export interface ApeeParent {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  lastReminded?: string;
  students: ApeeStudentLink[];
  totalDue: number;
  totalPaid: number;
  status: 'soldé' | 'partiel' | 'retard';
  note: string;
  payments: ApeePaymentItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ApeeExpense {
  id: string;
  type: 'command' | 'payment-order' | 'refund';
  title: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Executed';
  date: string;
  description: string;
  budgetLineId?: string; // Optional budget line association
}

export interface ApeeOtherRevenue {
  id: string;
  payerName: string;
  status: 'membre_honneur' | 'institution' | 'autre';
  statusDetails?: string; // Institution Details e.g. "Ministère"
  amount: number;
  paymentMethod: string;
  date: string;
  transactionId?: string;
  notes?: string;
  createdAt: string;
}

export interface ApeeActivityLog {
  id: string;
  parentId: string;
  timestamp: string;
  parentName: string;
  actionType: 'CREATE_PARENT' | 'UPDATE_PARENT' | 'ADD_PAYMENT' | 'REMOVE_PAYMENT' | 'DELETE_PARENT' | 'MANUAL_ENTRY';
  description: string;
  amount: number;
  operatorName: string;
}

export interface ApeeBudgetLine {
  id: string;
  name: string; // Nom de la ligne budgétaire, e.g. "Fournitures scolaires"
  allocatedAmount: number; // Montant alloué, en FCFA
  description?: string;
}

export interface ApeeObligationDefinition {
  id: string;
  name: string;
  amount: number;
  type: 'per_student' | 'per_parent';
  description?: string;
}

export interface ApeeSettings {
  associationName: string;
  shortName?: string;
  schoolYear: string;
  cotisationAmount: number;
  financialGoal: number;
  budgetLines?: ApeeBudgetLine[];
  honoraryContributions?: number;
  subventionsAndAids?: number;
  actualHonoraryContributions?: number;
  actualSubventionsAndAids?: number;
  expectedStudents?: number;
  country?: string;
  currency?: string;
  financialObligations?: ApeeObligationDefinition[];
  finManagerName?: string;
  finManagerPhone?: string;
  finManagerPassword?: string;
  pedManagerName?: string;
  pedManagerPhone?: string;
  pedManagerPassword?: string;
  logoUrl?: string;
  directorName?: string;
  directorPhone?: string;
  directorEmail?: string;
  surveillantName?: string;
  surveillantPhone?: string;
  censeurName?: string;
  censeurPhone?: string;
  classTeachers?: Array<{ classRoom: string; teacherName: string; teacherPhone: string; teacherEmail: string }>;
}

export interface Establishment {
  id: string;
  name: string;
  cotisationAmount: number;
  financialGoal: number;
  finManagerName: string;
  finManagerPhone: string;
  finManagerPassword?: string;
  pedManagerName?: string;
  pedManagerPhone?: string;
  pedManagerPassword?: string;
  schoolYear: string;
  ownerId: string;
  logoUrl?: string;
}

export interface SystemLog {
  id: string;
  parentId: string; // schoolId or system administrator id
  title: string; // description
  amount: number;
  dueDate: string; // type: 'CREATE_SCHOOL' | 'DELETE_SCHOOL' | 'PAYMENT' | 'SETTINGS_CHANGE'
  status: 'Paid';
  paymentDate: string; // timestamp isolation
  provider: string; // operatorName
}


