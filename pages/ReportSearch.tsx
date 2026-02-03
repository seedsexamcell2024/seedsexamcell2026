
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Student, ClassLevel, Subject, Mark, AttendanceRecord, TestType } from '../types.ts';
import { loadData, getActiveSessionYear, setActiveSessionYear } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

const ReportSearch = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [reportType, setReportType] = useState<'monthly' | 'term'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState('September');
  const [selectedTerm, setSelectedTerm] = useState('2nd');
  const [sessionYear, setSessionYear] = useState(VDB.toCanonicalYear(getActiveSessionYear()));
  const logoSrc = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  const termMonths: Record<string, string[]> = {
    '1st': ['September', 'October', 'November'],
    '2nd': ['February', 'March', 'April']
  };

  const fetchData = async (force: boolean = false) => {
    const [s, c, sub, m, a] = await Promise.all([
      loadData('students', force),
      loadData('classes', force),
      loadData('subjects', force),
      loadData('marks', force),
      loadData('attendance', force)
    ]);
    setStudents(s);
    setClasses(c);
    setSubjects(sub);
    setMarks(m);
    setAttendance(a);
  };

  useEffect(() => {
    fetchData();
  }, [sessionYear]);

  const handleYearChange = (newYear: string) => {
    setSessionYear(newYear);
    setActiveSessionYear(newYear);
  };

  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return students.filter(s => {
      const className = classes.find(c => c.id === s.gradeId)?.name.toLowerCase() || '';
      return s.name.toLowerCase().includes(term) || className.includes(term) || s.rollNumber.toLowerCase().includes(term);
    }).slice(0, 5);
  }, [searchTerm, students, classes]);

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [selectedStudentId, students]);

  const calculateGrade = (percentage: number) => {
    if (percentage >= 90) return 'A*';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    if (percentage >= 40) return 'E';
    return 'U';
  };

  const getMotivationalRemark = (grade: string) => {
    const remarks: Record<string, string> = {
      'A*': "Exceptional performance! Outstanding mastery. You are a role model.",
      'A': "Excellent work! Your dedication to excellence is truly commendable.",
      'B': "Good progress. With more focused effort, you can reach the top tier.",
      'C': "Satisfactory. Identify weak areas and dedicate more time to practice.",
      'D': "Developing. Consistent study habits will yield better results.",
      'E': "Considerable effort required. Seek teacher guidance immediately.",
      'U': "Serious intervention needed. Core concept mastery is mandatory."
    };
    return remarks[grade] || remarks['U'];
  };

  const termData = useMemo(() => {
    if (!selectedStudent || reportType !== 'term') return null;
    
    // STRICT CANONICAL LOCK
    const cYear = VDB.toCanonicalYear(sessionYear);
    const cTerm = VDB.toCanonicalTerm(selectedTerm);
    
    const studentMarks = marks.filter(m => 
      VDB.normalize(m.studentId) === VDB.normalize(selectedStudentId) &&
      VDB.toCanonicalYear(m.yearId) === cYear
    );
    
    const studentSubjects = subjects.filter(sub => selectedStudent.enrolledSubjects?.includes(sub.id));
    const currentMonths = termMonths[selectedTerm] || [];

    const rows = studentSubjects.map(sub => {
      const subMarks = studentMarks.filter(m => VDB.normalize(m.subjectId) === VDB.normalize(sub.id));
      const mScores = currentMonths.map(monthName => {
          const m = subMarks.find(mark => 
            mark.testType === TestType.MONTHLY && 
            VDB.normalize(mark.month).startsWith(VDB.normalize(monthName).substring(0, 3))
          );
          const val = parseFloat(String(m?.marksObtained || 0));
          return isNaN(val) ? 0 : val;
      });
      
      const examObj = subMarks.find(m => 
        m.testType === TestType.EXAM && 
        m.termId === cTerm
      );
      const examScore = parseFloat(String(examObj?.marksObtained || 0)) || 0;
      
      const monthlyTotal = mScores.reduce((a, b) => a + b, 0);
      const testPct = (monthlyTotal / 60) * 100;
      const examPct = (examScore / 100) * 100;
      const avgPct = monthlyTotal > 0 ? (testPct + examPct) / 2 : examPct;
      
      return { name: sub.name, mScores, testAvg: Math.round(monthlyTotal), examMarks: examScore, grade: calculateGrade(avgPct), avgPct: Math.round(avgPct) };
    });

    const studentAttendance = attendance.filter(a => VDB.normalize(a.studentId) === VDB.normalize(selectedStudentId) && VDB.toCanonicalYear(a.yearId) === cYear);
    let present = 0, absent = 0, working = 0;
    studentAttendance.forEach(a => { if (a.status === 'P') { present++; working++; } else if (a.status === 'A') { absent++; working++; } });
    const overallAvg = rows.length > 0 ? Math.round(rows.reduce((acc, r) => acc + r.avgPct, 0) / rows.length) : 0;
    return { rows, overallAvg, overallGrade: calculateGrade(overallAvg), attendance: { present, absent, working } };
  }, [selectedStudent, reportType, marks, subjects, selectedTerm, attendance, sessionYear]);

  const years = ["2023-2024", "2024-2025", "2025-2026", "2026-2027", "2027-2028"];

  return (
    <div className="space-y-6 animate-in pb-20 p-6 lg:p-16 bg-white min-h-screen">
      <button onClick={() => navigate('/')} className="px-8 py-3 bg-white border border-slate-200 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:bg-black hover:text-white transition-all print:hidden">
        BACK TO DASHBOARD
      </button>

      <div className="bg-slate-950 p-8 rounded-[2rem] text-white flex flex-col md:flex-row items-center gap-6 print:hidden shadow-xl">
        <div className="flex-1 text-left">
          <h2 className="text-2xl font-black uppercase tracking-tighter">SEARCH REGISTRY</h2>
          <p className="text-[9px] font-black text-white uppercase tracking-widest mt-1 opacity-60">Institutional Audit Node</p>
        </div>
        <div className="flex items-center gap-3">
           <select className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:border-white text-white" value={sessionYear} onChange={e => handleYearChange(e.target.value)}>
               {years.map(y => <option key={y} value={y} className="text-slate-900">Session {y}</option>)}
           </select>
           <div className="relative w-full md:w-80">
            <input 
              type="text" 
              placeholder="SCAN CANDIDATE NAME..." 
              className="bg-white/5 border border-white/10 rounded-xl px-6 py-3 text-xs outline-none focus:border-white w-full font-black uppercase tracking-widest"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setSelectedStudentId(''); }}
            />
            {searchTerm && !selectedStudentId && (
                <div className="absolute top-full mt-2 left-0 w-full bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-200 z-[100] text-slate-950">
                    {filteredStudents.map(s => (
                        <button key={s.id} onClick={() => { setSelectedStudentId(s.id); setSearchTerm(s.name); }} className="w-full text-left px-5 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-none">
                            <p className="text-[10px] font-black uppercase">{s.name}</p>
                            <p className="text-[8px] text-slate-400 font-bold">{s.rollNumber}</p>
                        </button>
                    ))}
                </div>
            )}
           </div>
        </div>
      </div>

      {selectedStudent && (
        <div className="space-y-6">
           <div className="bg-white p-3 rounded-2xl border border-slate-200 flex justify-between items-center print:hidden shadow-sm">
              <div className="flex gap-1 bg-slate-50 p-1 rounded-lg">
                 <button onClick={() => setReportType('monthly')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${reportType === 'monthly' ? 'bg-black text-white shadow-sm' : 'text-slate-400'}`}>Monthly View</button>
                 <button onClick={() => setReportType('term')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${reportType === 'term' ? 'bg-black text-white shadow-sm' : 'text-slate-400'}`}>Term View</button>
              </div>
              <div className="flex gap-2">
                 {reportType === 'term' && <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-black uppercase" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}><option value="1st">1st Term</option><option value="2nd">2nd Term</option></select>}
              </div>
           </div>
           {reportType === 'term' && termData && (
             <div className="max-w-[800px] mx-auto bg-white border border-slate-300 p-6 print:p-0 print:border-none min-h-[1050px] flex flex-col">
                <div className="flex items-center justify-between mb-6 border-b-2 border-slate-900 pb-4 h-24">
                    <div className="w-1/4">
                       <img src={logoSrc} className="max-w-[110px] max-h-20 object-contain" alt="SEEDS" />
                    </div>
                    <div className="flex-1 text-center">
                        <h1 className="text-xl font-black text-black uppercase leading-none mb-1">TERM REPORT CARD</h1>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 leading-none">SEEDS SCHOOL OF EXCELLENCE</p>
                    </div>
                    <div className="w-1/4 text-right">
                        <p className="text-[9px] font-black text-black uppercase">ID: {selectedStudent.rollNumber}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4 text-[10px] font-black uppercase">
                    <div className="flex border-b border-slate-100 pb-1 text-black"><span>Name:</span><span className="flex-1 text-right font-black">{selectedStudent.name}</span></div>
                    <div className="flex border-b border-slate-100 pb-1 text-black"><span>Class:</span><span className="flex-1 text-right font-black">{classes.find(c => c.id === selectedStudent.gradeId)?.name}</span></div>
                </div>
                <div className="flex-1 mb-6 border-2 border-slate-900 rounded-sm overflow-hidden">
                    <table className="w-full text-[9px] font-black uppercase border-collapse">
                        <thead className="bg-slate-100 border-b-2 border-slate-900 text-center">
                            <tr>
                                <th className="p-2 text-left border-r border-slate-900 text-black">Module</th>
                                {termMonths[selectedTerm].map(m => <th key={m} className="p-1.5 border-r border-slate-900 text-black">{m.substr(0,3)}</th>)}
                                <th className="p-1.5 border-r border-slate-900 bg-slate-50 text-black">M(60)</th>
                                <th className="p-1.5 border-r border-slate-900 text-black">Exam</th>
                                <th className="p-1.5 border-r border-slate-900 text-black">Avg%</th>
                                <th className="p-1.5 text-black">Grade</th>
                            </tr>
                        </thead>
                        <tbody className="text-center divide-y divide-slate-200">
                            {termData.rows.map((row, idx) => (
                                <tr key={idx} className="h-8">
                                    <td className="p-2 text-left border-r border-slate-300 text-black">{row.name}</td>
                                    {row.mScores.map((s, i) => <td key={i} className="border-r border-slate-300 text-black">{s}</td>)}
                                    <td className="border-r border-slate-300 bg-slate-50/10 text-black">{row.testAvg}</td>
                                    <td className="border-r border-slate-300 text-black">{row.examMarks}</td>
                                    <td className="border-r border-slate-300 text-black font-black">{row.avgPct}%</td>
                                    <td className="text-black font-black">{row.grade}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-black text-white h-10 border-t-2 border-slate-900">
                            <tr>
                                <td colSpan={termMonths[selectedTerm].length + 3} className="text-right px-6 uppercase text-[9px] tracking-widest font-black">Aggregate:</td>
                                <td colSpan={2} className="text-lg text-center font-black">{termData.overallAvg}%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="col-span-2 border-2 border-slate-900 rounded-sm p-4 min-h-[80px]">
                        <p className="text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">Principal Remarks</p>
                        <p className="text-[10px] font-black italic leading-tight text-justify text-black">{getMotivationalRemark(termData.overallGrade)}</p>
                    </div>
                    <div className="border-2 border-slate-900 rounded-sm p-3 flex flex-col justify-center gap-2">
                        <div className="flex justify-between border-b border-slate-50 text-[9px] font-black uppercase text-black"><span>Present:</span><span className="font-black text-black">{termData.attendance.present}</span></div>
                        <div className="flex justify-between text-[9px] font-black uppercase text-black"><span>Absent:</span><span className="font-black text-black">{termData.attendance.absent}</span></div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-20 pt-10 mt-auto border-t border-slate-100">
                    <div className="text-center border-t border-slate-950 pt-2"><p className="text-[8px] font-black uppercase tracking-widest text-black">Class Teacher</p></div>
                    <div className="text-center border-t border-slate-950 pt-2"><p className="text-[8px] font-black uppercase tracking-widest text-black">Principal</p></div>
                </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default ReportSearch;
