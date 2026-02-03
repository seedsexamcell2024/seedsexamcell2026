
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Subject, Mark, ClassLevel, TestType, Teacher, Student } from '../types.ts';
import { getActiveSessionYear, getActiveTerm, loadData, setActiveSessionYear, setActiveTerm } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

/**
 * SEEDS SUBJECT PERFORMANCE LEDGER v4.0
 * MISSION: CONSOLIDATED SUBJECT-WISE ANALYTICS
 */
const SubjectwiseReport = () => {
  const navigate = useNavigate();
  const [dataVersion, setDataVersion] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [filter, setFilter] = useState({
    year: VDB.toCanonicalYear(getActiveSessionYear()),
    term: getActiveTerm(),
    gradeId: localStorage.getItem('marks_last_grade') || '',
    subjectId: '',
    teacherId: '',
    month: 'ALL'
  });

  const years = ["2024-2025", "2025-2026", "2026-2027", "2027-2028"];
  const termsList = ["1st", "2nd"];
  
  const currentFullTermMonths = useMemo(() => {
    return filter.term.startsWith('1') ? ['September', 'October', 'November'] : ['February', 'March', 'April'];
  }, [filter.term]);

  const termMonthsForDisplay = useMemo(() => {
    if (filter.month === 'ALL') return currentFullTermMonths;
    if (!currentFullTermMonths.includes(filter.month)) return currentFullTermMonths;
    return [filter.month];
  }, [currentFullTermMonths, filter.month]);

  // CORE SYNC: Validates and Snaps UI state
  const syncUIFromVault = useCallback(() => {
    const allGradeNodes = VDB.queryAll<ClassLevel>('classes');
    setClasses(allGradeNodes);
    setSubjects(VDB.queryAll<Subject>('subjects'));
    setTeachers(VDB.queryAll<Teacher>('teachers'));
    setStudents(VDB.queryAll<Student>('students'));
    setMarks(VDB.queryAll<Mark>('marks'));
    
    setFilter(prev => {
        const normalizedGradeId = VDB.normalize(prev.gradeId);
        const isValid = allGradeNodes.some(c => VDB.normalize(c.id) === normalizedGradeId);
        if ((!prev.gradeId || !isValid) && allGradeNodes.length > 0) {
            const defaultId = allGradeNodes[0].id;
            localStorage.setItem('marks_last_grade', defaultId);
            return { ...prev, gradeId: defaultId };
        }
        return prev;
    });
    setDataVersion(v => v + 1);
  }, []);

  const fetchData = useCallback(async (force: boolean = false) => {
    setIsLoading(true);
    try {
      setActiveSessionYear(filter.year);
      setActiveTerm(filter.term);

      await Promise.all([
          loadData('classes', force),
          loadData('subjects', force),
          loadData('teachers', force),
          loadData('students', force),
          loadData('marks', true)
      ]);
      syncUIFromVault();
    } finally {
      setIsLoading(false);
    }
  }, [filter.year, filter.term, syncUIFromVault]);

  useEffect(() => {
    fetchData();
    window.addEventListener('DATA_UPDATED', syncUIFromVault);
    window.addEventListener('BOOT_COMPLETE', syncUIFromVault);
    return () => {
      window.removeEventListener('DATA_UPDATED', syncUIFromVault);
      window.removeEventListener('BOOT_COMPLETE', syncUIFromVault);
    };
  }, [filter.year, filter.term, fetchData, syncUIFromVault]);

  const ledgerData = useMemo(() => {
    if (!filter.gradeId || !filter.subjectId) return [];
    
    const normalizedGradeId = VDB.normalize(filter.gradeId);
    const classStudents = students.filter(s => VDB.normalize(s.gradeId) === normalizedGradeId);
    const normalizedSubId = VDB.normalize(filter.subjectId);
    
    const cYear = VDB.toCanonicalYear(filter.year);
    const cTerm = VDB.toCanonicalTerm(filter.term);
    
    return classStudents.map(student => {
      const studentId = VDB.normalize(student.id);
      
      const studentMarksInSession = marks.filter(m => 
        VDB.normalize(m.studentId) === studentId && 
        VDB.normalize(m.subjectId) === normalizedSubId && 
        VDB.toCanonicalYear(m.yearId) === cYear
      );

      const mScores = termMonthsForDisplay.map(mName => {
        const mark = studentMarksInSession.find(m => 
          m.testType === TestType.MONTHLY && 
          VDB.toCanonicalMonth(m.month) === VDB.toCanonicalMonth(mName)
        );
        const rawVal = mark?.marksObtained;
        const val = (rawVal === 'A' || rawVal === '' || rawVal === undefined) ? 0 : parseFloat(String(rawVal));
        return isNaN(val) ? 0 : val;
      });

      const savedSum = mScores.reduce((a, b) => a + b, 0);
      const examObj = studentMarksInSession.find(m => 
        m.testType === TestType.EXAM && 
        m.termId === cTerm
      );
      const examRaw = examObj?.marksObtained;
      const examObtained = (examRaw === 'A' || examRaw === '' || examRaw === undefined) ? 0 : parseFloat(String(examRaw));
      
      const testPct = (savedSum / 60) * 100;
      const examPct = (examObtained / 100) * 100;
      const avgPct = savedSum > 0 ? (testPct + examPct) / 2 : examPct;

      const getGrade = (p: number) => {
        if (p >= 90) return 'A*';
        if (p >= 80) return 'A';
        if (p >= 70) return 'B';
        if (p >= 60) return 'C';
        if (p >= 50) return 'D';
        if (p >= 40) return 'E';
        return 'U';
      };

      return {
        student,
        mScores,
        sum: savedSum,
        examObtained: examRaw === 'A' ? 'A' : examObtained,
        avgPct: Number(avgPct.toFixed(1)),
        grade: getGrade(avgPct)
      };
    }).sort((a, b) => (a.student.serialNumber || 0) - (b.student.serialNumber || 0));
  }, [filter, students, marks, termMonthsForDisplay, dataVersion]);

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  const filteredSubjects = useMemo(() => {
    const normalizedGradeId = VDB.normalize(filter.gradeId);
    if (!normalizedGradeId) return [];

    return subjects.filter(s => {
        const matchesGrade = VDB.normalize(s.gradeId) === normalizedGradeId;
        if (!filter.teacherId) return matchesGrade;
        
        const teacher = teachers.find(t => VDB.normalize(t.id) === VDB.normalize(filter.teacherId));
        const assignedIds = (teacher?.assignedSubjectIds || []).map(id => VDB.normalize(id));
        return matchesGrade && assignedIds.includes(VDB.normalize(s.id));
    });
  }, [subjects, teachers, filter.gradeId, filter.teacherId, dataVersion]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-40 selection:bg-black selection:text-white">
      <div className="bg-white border-b-4 border-black p-3 sticky top-0 z-[100] print:hidden shadow-lg">
        <div className="w-full flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
             <img src={logo} className="w-12 h-12 object-contain" alt="SEEDS" />
             <div>
                <h1 className="text-xl font-black uppercase tracking-tighter text-black leading-none">Performance Ledger</h1>
                <p className="text-[8px] font-black text-black uppercase tracking-widest mt-0.5">Session {filter.year} • Subject Audit Hub</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => window.print()} className="px-6 py-2 bg-black text-white rounded-xl text-[9px] font-black uppercase border-2 border-black shadow-[4px_4px_0_rgba(0,0,0,1)] hover:shadow-none transition-all">
                <i className="fas fa-print mr-2"></i> Print Ledger
             </button>
             <button onClick={() => navigate('/')} className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center text-xs shadow-lg hover:scale-105 transition-all"><i className="fas fa-home"></i></button>
          </div>
        </div>
      </div>

      <div className="w-full p-4 space-y-4">
        <div className="w-full bg-white border-4 border-black p-4 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-6 gap-4 print:hidden shadow-xl items-end">
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Session</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-2 py-1 text-[10px] font-black uppercase outline-none text-black" value={filter.year} onChange={e => { setFilter({...filter, year: e.target.value}); fetchData(true); }}>
                 {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Term</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-2 py-1 text-[10px] font-black uppercase outline-none text-black" value={filter.term} onChange={e => { setFilter({...filter, term: e.target.value, month: 'ALL'}); fetchData(true); }}>
                 {termsList.map(t => <option key={t} value={t}>{t} Term</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-2 py-1 text-[10px] font-black uppercase outline-none text-black" value={filter.gradeId} onChange={e => {
                setFilter({...filter, gradeId: e.target.value, subjectId: '', teacherId: ''});
                localStorage.setItem('marks_last_grade', e.target.value);
              }}>
                 <option value="">CHOOSE GRADE</option>
                 {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Faculty</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-2 py-1 text-[10px] font-black uppercase outline-none text-black" value={filter.teacherId} onChange={e => setFilter({...filter, teacherId: e.target.value, subjectId: ''})}>
                 <option value="">ALL FACULTY</option>
                 {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Module</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-2 py-1 text-[10px] font-black uppercase outline-none text-black" value={filter.subjectId} onChange={e => setFilter({...filter, subjectId: e.target.value})}>
                 <option value="">CHOOSE SUBJECT</option>
                 {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Month</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-2 py-1 text-[10px] font-black uppercase outline-none text-black" value={filter.month} onChange={e => setFilter({...filter, month: e.target.value})}>
                 <option value="ALL">ALL MONTHS</option>
                 {currentFullTermMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
           </div>
        </div>

        <div className="w-full bg-white border-4 border-black rounded-[3rem] overflow-hidden relative shadow-2xl min-h-[500px]">
           {isLoading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-[101] flex flex-col items-center justify-center">
                 <i className="fas fa-microchip fa-spin text-5xl text-black mb-4"></i>
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse text-black">Synchronizing Ledger...</p>
              </div>
           )}
           
           <div className="p-12 text-center border-b-4 border-black hidden print:block">
              <h2 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">{localStorage.getItem('schoolName') || PERMANENT_CONFIG.name}</h2>
              <h3 className="text-xl font-black uppercase tracking-widest text-black">SUBJECT PERFORMANCE MATRIX</h3>
              <div className="grid grid-cols-4 mt-8 text-[11px] font-black uppercase">
                 <div>CLASS: {classes.find(c => c.id === filter.gradeId)?.name || 'N/A'}</div>
                 <div>MODULE: {subjects.find(s => s.id === filter.subjectId)?.name || 'N/A'}</div>
                 <div>SESSION: {filter.year} • {filter.term} TERM</div>
                 <div>PERIOD: {filter.month === 'ALL' ? 'FULL TERM' : filter.month.toUpperCase()}</div>
              </div>
           </div>

           <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse border-b-4 border-black text-black min-w-[900px]">
                 <thead>
                    <tr className="bg-black text-white text-[9px] font-black uppercase border-b-4 border-black h-14">
                       <th rowSpan={2} className="border-r border-zinc-800 w-16 text-center">S#</th>
                       <th rowSpan={2} className="border-r border-zinc-800 text-left px-5 min-w-[240px]">CANDIDATE NAME</th>
                       <th colSpan={termMonthsForDisplay.length} className="border-r border-zinc-800 text-center bg-zinc-900">MONTHLY CYCLE (20)</th>
                       <th rowSpan={2} className="border-r border-zinc-800 w-16 text-center bg-zinc-900">SUM</th>
                       <th rowSpan={2} className="border-r border-zinc-800 w-24 text-center">EXAM (100)</th>
                       <th rowSpan={2} className="border-r border-zinc-800 w-16 text-center bg-zinc-900">AVG%</th>
                       <th rowSpan={2} className="w-14 text-center bg-zinc-900">GR</th>
                    </tr>
                    <tr className="bg-zinc-950 text-white text-[8px] font-black uppercase border-b-2 border-black h-10">
                       {termMonthsForDisplay.map(m => (
                         <th key={m} className="border-r border-zinc-800 text-center">{m.substring(0,3)}</th>
                       ))}
                    </tr>
                 </thead>
                 <tbody className="divide-y-2 divide-zinc-100 text-black">
                    {ledgerData.map((row, idx) => (
                      <tr key={idx} className="h-12 hover:bg-slate-50 border-b border-zinc-100 transition-colors">
                         <td className="border-r border-zinc-100 text-center text-[10px] font-black text-slate-300">#{idx + 1}</td>
                         <td className="border-r border-zinc-100 px-5 text-[11px] font-black uppercase text-slate-950">{row.student.name}</td>
                         {row.mScores.map((s: number, si: number) => (
                            <td key={si} className="border-r border-zinc-100 text-center text-[11px] font-black">{s}</td>
                         ))}
                         <td className="border-r border-zinc-100 text-center text-[11px] font-black bg-slate-50">{row.sum}</td>
                         <td className="border-r border-zinc-100 text-center text-[11px] font-black">{row.examObtained}</td>
                         <td className="border-r border-zinc-100 text-center text-[11px] font-black bg-slate-50">{row.avgPct}%</td>
                         <td className="text-center bg-slate-50 font-black text-black">{row.grade}</td>
                      </tr>
                    ))}
                    {ledgerData.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={6 + termMonthsForDisplay.length} className="py-60 text-center opacity-20">
                           <i className="fas fa-layer-group text-6xl block mb-6"></i>
                           <p className="text-[12px] font-black uppercase tracking-[0.4em]">Initialize Registry Parameters</p>
                        </td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 16px; width: 16px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #fff; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border: 4px solid #fff; }
        select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
        option { color: black !important; background: white !important; font-weight: 900 !important; }
      `}</style>
    </div>
  );
};

export default SubjectwiseReport;
