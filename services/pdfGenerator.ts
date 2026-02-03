
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, Mark, Subject, ClassLevel, TestType, Teacher } from '../types.ts';
import { PERMANENT_CONFIG } from '../config.ts';

/**
 * SEEDS PDF GENERATION ENGINE v6.2
 * Generates professional academic transcripts in Uint8Array format.
 * Theme: Minimalist Light Professional
 */

export const generateStudentReportPDF = async (
  type: 'MONTHLY' | 'TERM',
  student: Student,
  classes: ClassLevel[],
  subjects: Subject[],
  marks: Mark[],
  teachers: Teacher[],
  activeYear: string,
  selectedMonth?: string,
  selectedTerm?: string
): Promise<Uint8Array> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;
  const gradeObj = classes.find(c => c.id === student.gradeId);
  const gradeName = gradeObj?.name || 'N/A';
  const teacher = teachers.find(t => t.classTeacherOf?.includes(student.gradeId))?.name || 'N/A';
  const schoolName = localStorage.getItem('schoolName') || PERMANENT_CONFIG.name;

  // Render Logo on the left if it's base64 (which it usually is in this app's storage)
  try {
    if (logo.startsWith('data:image')) {
      doc.addImage(logo, 'PNG', 10, 10, 25, 25);
    }
  } catch (e) {
    console.warn("Monogram rendering skipped:", e);
  }
  
  // School Info - Left Aligned to clear the logo area if needed, but here centered text looks better with logo on side
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName.toUpperCase(), 105, 20, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(PERMANENT_CONFIG.address.toUpperCase(), 105, 26, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${type === 'MONTHLY' ? 'MONTHLY PROGRESS TRANSCRIPT' : 'TERMINAL ACADEMIC LEDGER'} - SESSION ${activeYear}`, 105, 36, { align: 'center' });

  // Metadata Box
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(10, 50, 190, 32);
  
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  
  doc.text(`CANDIDATE IDENTITY: ${student.name.toUpperCase()}`, 15, 58);
  doc.text(`REGISTRY ID: ${student.rollNumber}`, 15, 66);
  doc.text(`GRADE LEVEL: ${gradeName}`, 15, 74);
  
  doc.text(`ACADEMIC YEAR: ${activeYear}`, 125, 58);
  doc.text(`REPORT PERIOD: ${type === 'MONTHLY' ? selectedMonth : (selectedTerm + ' TERM')}`, 125, 66);
  doc.text(`CLASS TEACHER: ${teacher}`, 125, 74);

  // Table Logic
  const studentSubjects = subjects.filter(sub => student.enrolledSubjects?.includes(sub.id));
  const studentMarks = marks.filter(m => m.studentId === student.id && m.yearId === activeYear);

  let tableData: any[] = [];
  let tableHeaders: any[] = [];

  if (type === 'MONTHLY') {
    tableHeaders = [['NODE', 'SUBJECT MODULE', 'MAX', 'OBTAINED', '%AGE', 'GRADE']];
    studentSubjects.forEach((sub, idx) => {
      const mark = studentMarks.find(m => m.subjectId === sub.id && m.testType === TestType.MONTHLY && m.month === selectedMonth);
      const rawVal = mark?.marksObtained;
      const obtained = (rawVal === 'A' || rawVal === '' || rawVal === undefined) ? 0 : parseFloat(String(rawVal));
      const pct = (obtained / 20) * 100;
      tableData.push([
        idx + 1,
        sub.name.toUpperCase(),
        20,
        rawVal === 'A' ? 'A' : obtained,
        `${pct.toFixed(1)}%`,
        getPdfGrade(pct)
      ]);
    });
  } else {
    tableHeaders = [['NODE', 'SUBJECT MODULE', 'M(60)', 'EXAM(100)', 'TOTAL', 'AVG%', 'GRADE']];
    studentSubjects.forEach((sub, idx) => {
      const subMarks = studentMarks.filter(m => m.subjectId === sub.id);
      const mMarks = subMarks.filter(m => m.testType === TestType.MONTHLY && m.termId === selectedTerm);
      const monthlySum = mMarks.reduce((acc, m) => {
          const val = parseFloat(String(m.marksObtained));
          return acc + (isNaN(val) ? 0 : val);
      }, 0);
      
      const examMark = subMarks.find(m => m.testType === TestType.EXAM && m.termId === selectedTerm);
      const examObtained = parseFloat(String(examMark?.marksObtained)) || 0;
      
      const testPct = (monthlySum / 60) * 100;
      const examPct = (examObtained / 100) * 100;
      const avgPct = monthlySum > 0 ? (testPct + examPct) / 2 : examPct;

      tableData.push([
        idx + 1,
        sub.name.toUpperCase(),
        monthlySum,
        examMark?.marksObtained === 'A' ? 'A' : examObtained,
        '160',
        `${avgPct.toFixed(1)}%`,
        getPdfGrade(avgPct)
      ]);
    });
  }

  autoTable(doc, {
    startY: 88,
    head: tableHeaders,
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, halign: 'center' },
    styles: { fontSize: 8, cellPadding: 4, font: 'helvetica', textColor: [0, 0, 0] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 25 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 20 }
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 10, right: 10 }
  });

  // Remarks Section
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PRINCIPAL ASSESSMENTS:', 10, finalY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text('Candidate demonstrates a focused approach to the curriculum modules. Attendance and engagement metrics are satisfactory.', 10, finalY + 6, { maxWidth: 190 });

  // Signature Block - 2 Column Layout (Class Teacher and Principal)
  const sigY = 270;
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(20, sigY, 80, sigY); // Left line (Class Teacher)
  doc.line(130, sigY, 190, sigY); // Right line (Principal)

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text('CLASS TEACHER SIGNATURE', 50, sigY + 5, { align: 'center' });
  doc.text('PRINCIPAL', 160, sigY + 5, { align: 'center' });

  // Watermark
  doc.setFontSize(6);
  doc.setTextColor(200);
  doc.text('OFFICIAL TRANSCRIPT • SEEDS INSTITUTIONAL CORE ENGINE v9.4 • SECURE DIGITAL LEDGER', 105, 290, { align: 'center' });

  return new Uint8Array(doc.output('arraybuffer'));
};

const getPdfGrade = (p: number) => {
  if (p >= 90) return 'A*';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  if (p >= 40) return 'E';
  return 'U';
};
