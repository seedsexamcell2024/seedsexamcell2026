
export enum TestType {
  MONTHLY = 'Monthly Test',
  EXAM = 'Exam'
}

export enum UserRole {
  SUBJECT_TEACHER = 'Subject Teacher',
  SUBJECT_CLASS_TEACHER = 'Subject & Class Teacher',
  ADMIN_SUBJECT_TEACHER = 'Admin & Subject Teacher'
}

export interface Announcement extends ScopedEntity {
  content: string;
  isUrgent: boolean;
  timestamp: string;
}

export interface StoredReport {
  id: string;
  type: 'MONTHLY' | 'TERM';
  month?: string;
  term?: string;
  year: string;
  timestamp: string;
  pdfData: string;
  fileName: string;
}

export interface TimetableEntry extends ScopedEntity {
  gradeId: string;
  day: string;
  periodIndex: number;
  subjectId: string;
  teacherId: string;
}

export interface PeriodTiming {
  index: number;
  label: string;
  startTime: string;
  endTime: string;
}

export interface ScopedEntity {
  id: string;
  yearId: string;
  termId: '1st' | '2nd' | 'GLOBAL';
}

export interface Student extends ScopedEntity {
  serialNumber: number;
  name: string;
  rollNumber: string;
  gradeId: string;
  parentName: string;
  parentPhone: string;
  enrolledSubjects: string[];
  photo?: string;
  dateOfAdmission?: string;
  reports?: StoredReport[];
}

export interface Teacher extends ScopedEntity {
  serialNumber: number;
  name: string;
  phone: string;
  assignedGradeIds: string[];
  assignedSubjectIds: string[];
  classTeacherOf?: string[];
  role: UserRole;
}

export interface Subject extends ScopedEntity {
  serialNumber: number;
  name: string;
  gradeId: string;
}

export interface Mark extends ScopedEntity {
  studentId: string;
  subjectId: string;
  testType: TestType;
  month: string;
  marksObtained: number | string;
  totalMarks: number;
  date: string;
  teacherId?: string;
  // Added optional term property to match usage in registry audit and PDF generation
  term?: string;
}

export interface AttendanceRecord extends ScopedEntity {
  studentId: string;
  date: string;
  status: 'P' | '-' | 'H' | 'A' | string;
}

export interface ClassLevel extends ScopedEntity {
  serialNumber: number;
  name: string;
}

export interface SchoolConfig {
  name: string;
  monogram: string; 
  address: string;
  email: string;
  terms: string[];
  deploymentUrl?: string;
  developerPhoto: string;
  periodTimings?: PeriodTiming[];
}

// Added GitHubConfig to resolve import errors in githubService.ts
export interface GitHubConfig {
  isEnabled: boolean;
  isConnected: boolean;
  token?: string;
  owner?: string;
  repo?: string;
  branch: string;
}

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  headingColor: string;
  backgroundColor: string;
  cardColor: string;
  textColor: string;
  buttonTextColor: string;
  fontFamily: string;
  baseFontSize: number;
  headingFontSize: number;
  schoolName: string;
  schoolAddress: string;
  titles: {
    dashboard: string;
    students: string;
    teachers: string;
    subjects: string;
    marks: string;
    attendance: string;
    search: string;
    reports: string;
    admin: string;
  };
}
