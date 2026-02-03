
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Student, Subject, Mark, ClassLevel, TestType } from '../types.ts';
import { loadData, getActiveSessionYear, setActiveSessionYear } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';
import { useNavigate } from 'react-router-dom';

/**
 * SEEDS MONTHLY AWARD HUB v2.5
 * MISSION: CONSOLIDATED PERFORMANCE VISUALIZATION
 */
const MonthlyReports = () => {
  const navigate = useNavigate();
  const [dataVersion, setDataVersion] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [filter, setFilter] = useState({
    year: VDB.toCanonicalYear(getActiveSessionYear()),
    gradeId: localStorage.getItem('marks_last_grade') || '',
    month: 'September'
  });

  const yearsList = ["2024-2025", "2025-2026", "2026-2027", "2027-2028"];
  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const syncUIFromVault = useCallback(() => {
    const allGradeNodes = VDB.queryAll<ClassLevel>('classes');
    setStudents(VDB.queryAll<Student>('students'));
    setSubjects(VDB.queryAll<Subject>('subjects'));
    setMarks(VDB.queryAll<Mark>('marks'));
    setClasses(allGradeNodes);
    
    setFilter(prev => {
        const normalizedGradeId = VDB.normalize(prev.gradeId);
        const isValid = allGradeNodes.some(c => VDB.normalize(c.id) === normalizedGradeId);
        if ((!prev.gradeId || !isValid) && allGradeNodes.length > 0) {
            return { ...prev, gradeId: allGradeNodes[0].id };
        }
        return prev;
    });
    setDataVersion(v => v + 1);
  }, []);

  const fetchData = useCallback(async (force: boolean = false) => {
    setIsLoading(true);
    try {
      setActiveSessionYear(filter.year);
      await Promise.all([
        loadData('students', force),
        loadData('subjects', force),
        loadData('marks', true),
        loadData('classes', force)
      ]);
      syncUIFromVault();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [filter.year, syncUIFromVault]);

  useEffect(() => {
    fetchData();
    window.addEventListener('DATA_UPDATED', syncUIFromVault);
    window.addEventListener('BOOT_COMPLETE', syncUIFromVault);
    return () => {
        window.removeEventListener('DATA_UPDATED', syncUIFromVault);
        window.removeEventListener('BOOT_COMPLETE', syncUIFromVault);
    };
  }, [filter.year, fetchData, syncUIFromVault]);

  const calculateGrade = (percentage: number) => {
    if (percentage >= 90) return 'A*';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    if (percentage >= 40) return 'E';
    return 'U';
  };

  const ledgerData = useMemo(() => {
    if (!filter.gradeId) return [];
    
    const normalizedGradeId = VDB.normalize(filter.gradeId);
    const classStudents = students.filter(s => VDB.normalize(s.gradeId) === normalizedGradeId);
    const classSubjects = subjects.filter(sub => VDB.normalize(sub.gradeId) === normalizedGradeId);
    
    const activeYear = VDB.toCanonicalYear(filter.year);
    const canonicalMonth = VDB.toCanonicalMonth(filter.month);
    
    return classStudents.map(student => {
      const studentMarks = marks.filter(m => 
        VDB.normalize(m.studentId) === VDB.normalize(student.id) && 
        VDB.toCanonicalMonth(m.month) === canonicalMonth && 
        m.testType === TestType.MONTHLY && 
        VDB.toCanonicalYear(m.yearId) === activeYear
      );
      
      const scores: any = { student };
      let totalObtained = 0;
      classSubjects.forEach(sub => {
        const mark = studentMarks.find(m => VDB.normalize(m.subjectId) === VDB.normalize(sub.id));
        const val = parseFloat(String(mark?.marksObtained || 0)) || 0;
        scores[sub.id] = val;
        totalObtained += val;
      });
      
      scores.total = totalObtained;
      const possibleMax = classSubjects.length * 20;
      scores.pct = possibleMax > 0 ? (totalObtained / possibleMax) * 100 : 0;
      scores.grade = calculateGrade(scores.pct);
      return scores;
    }).sort((a, b) => (a.student.serialNumber || 0) - (b.student.serialNumber || 0));
  }, [filter, students, subjects, marks, dataVersion]);

  const activeSubjects = useMemo(() => {
    return subjects.filter(s => VDB.normalize(s.gradeId) === VDB.normalize(filter.gradeId));
  }, [subjects, filter.gradeId, dataVersion]);

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-40">
      <div className="bg-white border-b-4 border-black p-3 sticky top-0 z-[100] print:hidden shadow-lg">
        <div className="w-full flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
             <img src={logo} className="w-12 h-12 object-contain" alt="SEEDS" />
             <div>
                <h1 className="text-xl font-black uppercase tracking-tighter text-black leading-none">Class Award Ledger</h1>
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">Institutional Honor Roll • Monthly Matrix</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => window.print()} className="px-6 py-2 bg-black text-white rounded-xl text-[9px] font-black uppercase border-2 border-black shadow-[4px_4px_0_rgba(0,0,0,1)] hover:shadow-none transition-all">
                <i className="fas fa-print mr-2"></i> Print Award List
             </button>
             <button onClick={() => navigate('/')} className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center text-xs shadow-lg hover:scale-105 transition-all"><i className="fas fa-home"></i></button>
          </div>
        </div>
      </div>

      <div className="w-full p-4 space-y-4">
        <div className="w-full bg-white border-4 border-black p-4 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden shadow-xl items-end">
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Session</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.year} onChange={e => {setFilter({...filter, year: e.target.value}); fetchData(true);}}>
                 {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade Cluster</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.gradeId} onChange={e => {setFilter({...filter, gradeId: e.target.value}); localStorage.setItem('marks_last_grade', e.target.value);}}>
                 <option value="">CHOOSE CLASS</option>
                 {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Audit Month</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.month} onChange={e => setFilter({...filter, month: e.target.value})}>
                 {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
           </div>
        </div>

        <div className="w-full bg-white border-4 border-black rounded-[3rem] overflow-hidden relative shadow-2xl min-h-[500px]">
           {isLoading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-[80] flex flex-col items-center justify-center">
                 <i className="fas fa-sync fa-spin text-5xl text-black mb-4"></i>
                 <p className="text-[10px] font-black uppercase tracking-[0.4em]">Compiling Statistics...</p>
              </div>
           )}
           
           <div className="p-12 text-center border-b-4 border-black hidden print:block">
              <h2 className="text-4xl font-black uppercase tracking-tighter leading-none mb-4">{localStorage.getItem('schoolName') || PERMANENT_CONFIG.name}</h2>
              <h3 className="text-xl font-black uppercase tracking-[0.4em] text-black">MONTHLY ACADEMIC AWARD LIST</h3>
              <div className="flex justify-center gap-10 mt-6 text-[12px] font-black uppercase">
                 <p>GRADE: {classes.find(c => c.id === filter.gradeId)?.name || 'N/A'}</p>
                 <p>PERIOD: {filter.month.toUpperCase()} {filter.year}</p>
              </div>
           </div>
           
           <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse border-b-4 border-black text-black">
                 <thead>
                    <tr className="bg-black text-white text-[9px] font-black uppercase tracking-widest h-14 border-b-4 border-black">
                       <th className="border-r border-zinc-800 w-16 text-center">S#</th>
                       <th className="border-r border-zinc-800 text-left px-5 min-w-[240px]">CANDIDATE NAME</th>
                       {activeSubjects.map(sub => (
                         <th key={sub.id} className="border-r border-zinc-800 text-center p-2 leading-tight vertical-text min-w-[40px]">{sub.name}</th>
                       ))}
                       <th className="border-r border-zinc-800 w-16 text-center bg-zinc-900">TOT</th>
                       <th className="border-r border-zinc-800 w-16 text-center bg-zinc-900">%AGE</th>
                       <th className="w-14 text-center bg-zinc-900">GR</th>
                    </tr>
                 </thead>
                 <tbody className="text-[11px] font-black uppercase divide-y-2 divide-zinc-100">
                    {ledgerData.map((row, idx) => (
                      <tr key={idx} className="h-12 hover:bg-slate-50 transition-colors">
                         <td className="border-r border-zinc-200 text-center text-slate-300">#{idx + 1}</td>
                         <td className="border-r border-zinc-200 px-5 text-slate-950">{row.student.name}</td>
                         {activeSubjects.map(sub => (
                           <td key={sub.id} className="border-r border-zinc-100 text-center">{row[sub.id]}</td>
                         ))}
                         <td className="border-r border-zinc-200 text-center bg-slate-50">{row.total}</td>
                         <td className="border-r border-zinc-200 text-center bg-slate-50 font-black">{Math.round(row.pct)}%</td>
                         <td className="text-center bg-slate-50 font-black text-black">{row.grade}</td>
                      </tr>
                    ))}
                    {ledgerData.length === 0 && !isLoading && (
                       <tr>
                          <td colSpan={activeSubjects.length + 5} className="py-60 text-center opacity-20">
                             <i className="fas fa-medal text-6xl block mb-6"></i>
                             <p className="text-[12px] font-black uppercase tracking-[0.5em]">Awaiting Matrix Parameters</p>
                          </td>
                       </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
      <style>{`
        .vertical-text {
          writing-mode: vertical-lr;
          transform: rotate(180deg);
          white-space: nowrap;
          height: 120px;
        }
        .custom-scrollbar::-webkit-scrollbar { height: 16px; width: 16px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #fff; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border: 4px solid #fff; }
        select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
        option { color: black !important; background: white !important; font-weight: 900 !important; }
      `}</style>
    </div>
  );
};

export default MonthlyReports;
