const fs = require('fs');
const css = fs.readFileSync('style.css', 'utf8');
console.log('--- media queries ---');
console.log((css.match(/@media[^{]+/g) || []).join('\n'));

// ---------- report card logic harness ----------
const normalizedTerm = term => /^(2|second)/i.test(String(term || '').trim()) ? '2nd Term' : '1st Term';
const termMonths = {
  '1st Term': [{ month: 9, label: 'September' }, { month: 10, label: 'October' }, { month: 11, label: 'November' }],
  '2nd Term': [{ month: 2, label: 'February' }, { month: 3, label: 'March' }, { month: 4, label: 'April' }]
};
const gradeForPercentage = p => p >= 90 ? 'A*' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : p >= 40 ? 'E' : 'U';

const students = [
  { id: 's1', class_id: 'c1', full_name: 'Zara Bello', student_id: 'ST-001', gender: 'Female' },
  { id: 's2', class_id: 'c1', full_name: 'Ada Chukwu', student_id: 'ST-002', gender: 'Male' },
  { id: 's3', class_id: 'c2', full_name: 'Musa Yusuf', student_id: 'ST-003', gender: 'Male', roll_number: '07' }
];
const classes = [{ id: 'c1', name: 'JSS 1A' }, { id: 'c2', name: 'JSS 2A' }];
const assessments = [
  { id: 'a1', class_id: 'c1', subject_id: 'sub1', assessment_type: 'Monthly test', assessment_date: '2026-09-08', term: '1st Term', max_marks: 20 },
  { id: 'a2', class_id: 'c1', subject_id: 'sub1', assessment_type: 'Monthly test', assessment_date: '2026-10-08', term: '1st Term', max_marks: 20 },
  { id: 'a3', class_id: 'c1', subject_id: 'sub1', assessment_type: 'Term exam', assessment_date: '2026-12-18', term: '1st Term', max_marks: 60 },
  { id: 'a4', class_id: 'c1', subject_id: 'sub2', assessment_type: 'Monthly test', assessment_date: '2026-09-08', term: '1st Term', max_marks: 20 },
  { id: 'a5', class_id: 'c2', subject_id: 'sub1', assessment_type: 'Monthly test', assessment_date: '2026-09-08', term: '1st Term', max_marks: 20 },
  { id: 'a6', class_id: 'c1', subject_id: 'sub1', assessment_type: 'Monthly test', assessment_date: '2027-02-08', term: '2nd Term', max_marks: 20 }
];
const marks = [
  { assessment_id: 'a1', student_id: 's1', score: 18 },
  { assessment_id: 'a2', student_id: 's1', score: 16 },
  { assessment_id: 'a3', student_id: 's1', score: 48 },
  { assessment_id: 'a4', student_id: 's1', score: 10 },
  { assessment_id: 'a1', student_id: 's2', score: 12 }
];
const attendance = [
  { student_id: 's1', attendance_date: '2026-09-07', status: 'present' },
  { student_id: 's1', attendance_date: '2026-09-08', status: 'absent' },
  { student_id: 's1', attendance_date: '2026-09-09', status: 'leave' },
  { student_id: 's1', attendance_date: '2026-12-18', status: 'present' },
  { student_id: 's1', attendance_date: '2027-02-08', status: 'present' }
];
const classSubjects = [
  { id: 'cs1', class_id: 'c1', subject_id: 'sub1', teacher_id: 't1' },
  { id: 'cs2', class_id: 'c1', subject_id: 'sub2', teacher_id: 't2' }
];

const state = { reportCardTerm: '1st Term', reportCardMonth: '9', reportCardScope: 'monthly', reportCardClass: '' };
const records = (t) => ({ students, classes, assessments, marks, attendance, class_subjects: classSubjects }[t] || []);
const subjectName = id => ({ sub1: 'Mathematics', sub2: 'English' }[id] || '—');
const currentSchool = () => ({ academic_year: '2026' });

const reportCardMonths = () => termMonths[normalizedTerm(state.reportCardTerm)];
const reportCardScopeMonths = (scope = state.reportCardScope) => {
  const months = reportCardMonths();
  if (!months.length) return [];
  if (scope === 'term') return months;
  const stored = Number(state.reportCardMonth);
  const match = months.find(item => item.month === stored);
  return match ? [match] : [months[0]];
};
const reportCardTermYears = term => {
  const baseYear = Number(currentSchool().academic_year) || new Date().getFullYear();
  return normalizedTerm(term) === '2nd Term' ? [baseYear + 1] : [baseYear];
};
const reportCardAttendanceMonths = scope => {
  const months = reportCardScopeMonths(scope);
  if (scope !== 'term') return months;
  const examMonth = normalizedTerm(state.reportCardTerm) === '2nd Term' ? 5 : 12;
  return months.some(item => item.month === examMonth) ? months : [...months, { month: examMonth, label: 'Term exam' }];
};
const studentRollNumber = student => {
  const stored = String(student.roll_number || '').trim();
  if (stored) return stored;
  const classmates = records('students').filter(row => row.class_id === student.class_id)
    .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
  const position = classmates.findIndex(row => row.id === student.id);
  return position >= 0 ? String(position + 1).padStart(2, '0') : '—';
};

const reportCardSubjectSummaries = (student, scope) => {
  const term = normalizedTerm(state.reportCardTerm);
  const month = Number(state.reportCardMonth || 0);
  const years = reportCardTermYears(state.reportCardTerm);
  const markIndex = new Map(records('marks').map(mark => [`${mark.assessment_id}:${mark.student_id}`, mark]));
  const assignments = records('class_subjects').filter(row => row.class_id === student.class_id);
  return assignments.map(assignment => {
    const assessments = records('assessments').filter(row => {
      if (row.class_id !== student.class_id || row.subject_id !== assignment.subject_id) return false;
      if (normalizedTerm(row.term) !== term) return false;
      const date = String(row.assessment_date || '');
      if (!years.includes(Number(date.slice(0, 4)))) return false;
      if (scope === 'term') return true;
      return row.assessment_type === 'Monthly test' && Number(date.slice(5, 7)) === month;
    }).sort((a, b) => a.assessment_date.localeCompare(b.assessment_date));
    const total = assessments.reduce((sum, row) => sum + Number(row.max_marks), 0);
    const obtained = assessments.reduce((sum, row) => {
      const mark = markIndex.get(`${row.id}:${student.id}`);
      return sum + (mark ? Number(mark.score) : 0);
    }, 0);
    const percentage = total ? obtained / total * 100 : null;
    return { subject: subjectName(assignment.subject_id), total, obtained, percentage, grade: percentage === null ? '—' : gradeForPercentage(percentage) };
  }).filter(row => row.total > 0);
};

const reportCardAttendanceSummary = (student, scope) => {
  const scopeMonths = reportCardAttendanceMonths(scope);
  const years = reportCardTermYears(state.reportCardTerm);
  const rows = records('attendance').filter(row => {
    if (row.student_id !== student.id) return false;
    const date = String(row.attendance_date || '');
    const month = Number(date.slice(5, 7));
    const year = Number(date.slice(0, 4));
    return scopeMonths.some(item => item.month === month) && years.includes(year);
  });
  const present = rows.filter(row => row.status === 'present').length;
  const absent = rows.filter(row => row.status === 'absent').length;
  const leave = rows.filter(row => row.status === 'leave').length;
  const workingDates = new Set(rows.filter(row => row.status !== 'holiday').map(row => row.attendance_date));
  const workingDays = workingDates.size;
  return { workingDays, present, absent, leave, rate: workingDays ? Math.round(present / workingDays * 100) : 0 };
};

console.log('\n=== REPORT CARD LOGIC TESTS ===');
let pass = 0, fail = 0;
const t = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} | got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`);
};

const s1 = students[0], s2 = students[1], s3 = students[2];

// monthly scope, September 2026
state.reportCardTerm = '1st Term'; state.reportCardMonth = '9'; state.reportCardScope = 'monthly';
let sums = reportCardSubjectSummaries(s1, 'monthly');
t('monthly: only September monthly tests', sums.map(r => r.subject).sort(), ['English', 'Mathematics']);
t('monthly: maths 18/20 = 90% grade A*', [sums.find(r => r.subject === 'Mathematics').percentage, sums.find(r => r.subject === 'Mathematics').grade], [90, 'A*']);
t('monthly: english 10/20 = 50% grade D', [sums.find(r => r.subject === 'English').percentage, sums.find(r => r.subject === 'English').grade], [50, 'D']);

// term scope includes the term exam
sums = reportCardSubjectSummaries(s1, 'term');
const maths = sums.find(r => r.subject === 'Mathematics');
t('term: maths includes 3 assessments (2 monthly + exam)', maths.total, 100);
t('term: maths obtained 18+16+48 = 82', maths.obtained, 82);
t('term: maths 82% grade A', [Math.round(maths.percentage), maths.grade], [82, 'A']);

// term attendance includes the December exam month
let att = reportCardAttendanceSummary(s1, 'term');
t('term attendance: working days = Sept(3) + Dec(1) = 4', att.workingDays, 4);
t('term attendance: present 2, absent 1, leave 1', [att.present, att.absent, att.leave], [2, 1, 1]);

// monthly attendance for September only
att = reportCardAttendanceSummary(s1, 'monthly');
t('monthly attendance: Sept only = 3 days', att.workingDays, 3);
t('monthly attendance: present 1 absent 1 leave 1', [att.present, att.absent, att.leave], [1, 1, 1]);

// 2nd term maps to the following calendar year
state.reportCardTerm = '2nd Term'; state.reportCardMonth = '2';
sums = reportCardSubjectSummaries(s1, 'term');
t('2nd term: uses year 2027 assessment a6 (1 subject)', sums.map(r => r.subject), ['Mathematics']);
t('2nd term: a6 total is 20 (only the 2027 assessment)', sums[0].total, 20);
t('2nd term: s1 has no mark on a6 => 0%', sums[0].percentage, 0);
t('2nd term: excludes 2026 1st-term assessments', sums[0].total !== 100, true);
att = reportCardAttendanceSummary(s1, 'term');
t('2nd term: attendance uses 2027 (1 record on 2027-02-08)', att.workingDays, 1);

// empty / no-mark state
state.reportCardTerm = '1st Term'; state.reportCardMonth = '9';
sums = reportCardSubjectSummaries(s2, 'monthly');
t('recorded mark used: Ada maths 12/20 = 60%', sums.find(r => r.subject === 'Mathematics').percentage, 60);
t('no mark recorded => English 0/20 = 0%', sums.find(r => r.subject === 'English').percentage, 0);
t('no mark recorded => grade U', sums.find(r => r.subject === 'English').grade, 'U');

// roll numbers
t('roll: fallback uses class position 01 (Ada sorts before Zara)', studentRollNumber(s2), '01');
t('roll: fallback position 02 for Zara', studentRollNumber(s1), '02');
t('roll: stored value wins', studentRollNumber(s3), '07');
t('roll: unknown student -> em dash', studentRollNumber({ id: 'x', class_id: 'c9', full_name: 'Nobody' }), '—');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
