
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Student, Subject, Mark, ClassLevel, TestType, Teacher } from '../types.ts';
import { PERMANENT_CONFIG } from '../config.ts';
import { loadData, getActiveSessionYear, getActiveTerm, setActiveSessionYear, setActiveTerm } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { useNavigate } from 'react-router-dom';

/**
 * SEEDS TRANSCRIPT HUB v6.0
 * MISSION: UNIFIED LEDGER VERIFICATION & NODE SYNC
 */
const ReportCards = () => {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const [syncState, setSyncState] = useState(0);
  const [reportMode, setReportMode] = useState<'TERM' | 'MONTHLY' | 'SUBJECT'>('TERM');
  const [isLoading, setIsLoading] = useState(false);
  
  const [filter, setFilter] = useState({
    year: VDB.toCanonicalYear(getActiveSessionYear()),
    term: getActiveTerm() as '1st' | '2nd',
    gradeId: localStorage.getItem('marks_last_grade') || '',
    subjectId: '',
    selectedStudentId: '',
    month: 'September'
  });

  const yearsList = ["2023-2024", "2024-2025", "2025-2026", "2026-2027", "2027-2028"];
  const termsList = ["1st", "2nd"];
  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Reactive nodes from VDB
  const classes = useMemo(() => VDB.queryAll<ClassLevel>('classes'), [syncState]);
  const students = useMemo(() => VDB.queryAll<Student>('students'), [syncState]);
  const subjects = useMemo(() => VDB.queryAll<Subject>('subjects'), [syncState]);
  const marks = useMemo(() => VDB.queryAll<Mark>('marks'), [syncState]);
  const teachers = useMemo(() => VDB.queryAll<Teacher>('teachers'), [syncState]);

  const syncUIFromVault = useCallback(() => {
    setSyncState(VDB.syncCounter);
    
    const allGradeNodes = VDB.queryAll<ClassLevel>('classes');
    if (allGradeNodes.length > 0 && !filter.gradeId) {
      setFilter(prev => ({ ...prev, gradeId: allGradeNodes[0].id }));
    }
  }, [filter.gradeId]);

  const fetchData = useCallback(async (force: boolean = false) => {
    setIsLoading(true);
    try {
      setActiveSessionYear(filter.year);
      setActiveTerm(filter.term);

      // Single Vault Pull
      await loadData('identity', force);
      syncUIFromVault();
    } catch (e) {
      console.error("Report Sync Failure:", e);
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
  }, [filter.year, filter.term, syncUIFromVault]);

  const studentList = useMemo(() => {
    if (!filter.gradeId) return [];
    return VDB.getStudentsByClass(filter.gradeId);
  }, [filter.gradeId, syncState]);

  const availableSubjects = useMemo(() => {
    const normalizedGradeId = VDB.normalize(filter.gradeId);
    return subjects.filter(s => VDB.normalize(s.gradeId) === normalizedGradeId);
  }, [subjects, filter.gradeId, syncState]);

  const calculateGrade = (percentage: number) => {
    if (percentage >= 90) return 'A*';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    if (percentage >= 40) return 'E';
    return 'U';
  };

  const individualReportData = useMemo(() => {
    if (reportMode === 'SUBJECT' || !filter.selectedStudentId) return null;
    const student = students.find(s => VDB.normalize(s.id) === VDB.normalize(filter.selectedStudentId));
    if (!student) return null;

    const cYear = VDB.toCanonicalYear(filter.year);
    const cTerm = VDB.toCanonicalTerm(filter.term);
    const studentMarks = marks.filter(m => 
      VDB.normalize(m.studentId) === VDB.normalize(student.id) && 
      VDB.toCanonicalYear(m.yearId) === cYear
    );

    const teacher = teachers.find(t => (t.classTeacherOf || []).map(VDB.normalize).includes(VDB.normalize(student.gradeId)))?.name || 'Faculty Representative';
    const mIdx = monthsList.indexOf(filter.month);
    const sessionStartYear = parseInt(filter.year.split('-')[0]);
    const calendarYear = (mIdx >= 0 && mIdx <= 5) ? sessionStartYear + 1 : sessionStartYear;
    
    const daysInM = new Date(calendarYear, mIdx + 1, 0).getDate();
    let present = 0, absent = 0, working = 0;
    
    for (let d = 1; d <= daysInM; d++) {
        const dateStr = `${calendarYear}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (VDB.isWeekend(dateStr)) continue;
        const stat = VDB.getAttendanceStatus(student.id, dateStr);
        if (stat === 'H') continue;
        working++;
        if (stat === 'P') present++; else if (stat === 'A') absent++;
    }

    const studentSubjects = subjects.filter(sub => (student.enrolledSubjects || []).map(VDB.normalize).includes(VDB.normalize(sub.id)));
    
    if (reportMode === 'MONTHLY') {
      const rows = studentSubjects.map(sub => {
        const m = studentMarks.find(mark => 
          VDB.normalize(mark.subjectId) === VDB.normalize(sub.id) && 
          mark.testType === TestType.MONTHLY && 
          VDB.toCanonicalMonth(mark.month) === VDB.toCanonicalMonth(filter.month)
        );
        const obtained = parseFloat(String(m?.marksObtained || 0)) || 0;
        const pct = (obtained / 20) * 100;
        return { name: sub.name, obtained, pct: Number(pct.toFixed(1)), grade: calculateGrade(pct) };
      });
      return { student, rows, teacher, attendance: { present, absent, working } };
    } else {
      const testMonths = cTerm === '1st' ? ['September', 'October', 'November'] : ['February', 'March', 'April'];
      const rows = studentSubjects.map(sub => {
        const subMarks = studentMarks.filter(m => VDB.normalize(m.subjectId) === VDB.normalize(sub.id));
        const mScores = testMonths.map(mon => {
          const m = subMarks.find(mark => 
            mark.testType === TestType.MONTHLY && 
            VDB.toCanonicalMonth(mark.month).startsWith(VDB.toCanonicalMonth(mon).substring(0, 3))
          );
          const val = parseFloat(String(m?.marksObtained || 0));
          return isNaN(val) ? 0 : val;
        });
        const monthlyTotal = mScores.reduce((a, b) => a + b, 0);
        const examObj = subMarks.find(mark => mark.testType === TestType.EXAM && mark.termId === cTerm);
        const examObtained = parseFloat(String(examObj?.marksObtained || 0)) || 0;
        const testPct = (monthlyTotal / 60) * 100;
        const examPct = (examObtained / 100) * 100;
        const avgPct = monthlyTotal > 0 ? (testPct + examPct) / 2 : examPct;
        return { name: sub.name, mScores, monthlyTotal, examObtained, avgPct: Number(avgPct.toFixed(1)), grade: calculateGrade(avgPct) };
      });
      return { student, rows, teacher, attendance: { present, absent, working }, testMonths };
    }
  }, [syncState, filter, reportMode]);

  const subjectLedgerData = useMemo(() => {
    if (reportMode !== 'SUBJECT' || !filter.gradeId || !filter.subjectId) return [];
    
    const cYear = VDB.toCanonicalYear(filter.year);
    const cTerm = VDB.toCanonicalTerm(filter.term);
    const termMonths = cTerm === '1st' ? ['September', 'October', 'November'] : ['February', 'March', 'April'];
    const normalizedSubId = VDB.normalize(filter.subjectId);
    
    return studentList.map(student => {
      const studentMarks = marks.filter(m => 
        VDB.normalize(m.studentId) === VDB.normalize(student.id) && 
        VDB.normalize(m.subjectId) === normalizedSubId && 
        VDB.toCanonicalYear(m.yearId) === cYear && 
        m.termId === cTerm
      );

      const mScores = termMonths.map(mName => {
        const mark = studentMarks.find(m => 
          m.testType === TestType.MONTHLY && 
          VDB.toCanonicalMonth(m.month).startsWith(VDB.toCanonicalMonth(mName).substring(0, 3))
        );
        return parseFloat(String(mark?.marksObtained || 0)) || 0;
      });

      const savedSum = mScores.reduce((a, b) => a + b, 0);
      const examObj = studentMarks.find(m => m.testType === TestType.EXAM);
      const examObtained = parseFloat(String(examObj?.marksObtained || 0)) || 0;
      const testPct = (savedSum / 60) * 100;
      const examPct = (examObtained / 100) * 100;
      const avgPct = savedSum > 0 ? (testPct + examPct) / 2 : examPct;

      return { student, mScores, sum: savedSum, examObtained, avgPct: Number(avgPct.toFixed(1)), grade: calculateGrade(avgPct) };
    });
  }, [reportMode, filter, syncState, studentList]);

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-40 selection:bg-black selection:text-white">
      <div className="bg-white border-b-4 border-black p-3 sticky top-0 z-[100] print:hidden shadow-lg">
        <div className="w-full flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
             <img src={logo} className="w-12 h-12 object-contain" alt="SEEDS" />
             <div>
                <h1 className="text-xl font-black uppercase tracking-tighter text-black leading-none">Unified Transcript Hub</h1>
                <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mt-1">Audit Protocol v6.0 • Session {filter.year}</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <div className="flex bg-slate-50 p-1 rounded-xl border-2 border-black mr-2 shadow-sm">
                <button onClick={() => setReportMode('TERM')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reportMode === 'TERM' ? 'bg-black text-white shadow-xl' : 'text-slate-400'}`}>Term Card</button>
                <button onClick={() => setReportMode('MONTHLY')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reportMode === 'MONTHLY' ? 'bg-black text-white shadow-xl' : 'text-slate-400'}`}>Monthly View</button>
                <button onClick={() => setReportMode('SUBJECT')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reportMode === 'SUBJECT' ? 'bg-black text-white shadow-xl' : 'text-slate-400'}`}>Subject Ledger</button>
             </div>
             <button onClick={() => window.print()} className="px-6 py-2 bg-black text-white rounded-xl text-[9px] font-black uppercase border-2 border-black shadow-[4px_4px_0_rgba(0,0,0,1)] hover:shadow-none transition-all"><i className="fas fa-print mr-2"></i> Print</button>
             <button onClick={() => navigate('/')} className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center text-xs shadow-lg hover:scale-105 transition-all"><i className="fas fa-home"></i></button>
          </div>
        </div>
      </div>

      <div className="w-full p-4 space-y-4">
        <div className={`w-full bg-white border-4 border-black p-4 rounded-[2rem] grid ${reportMode === 'MONTHLY' ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'} gap-4 print:hidden shadow-xl items-end`}>
           <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Session</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.year} onChange={e => {setFilter({...filter, year: e.target.value}); fetchData(true);}}>
                 {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Term</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.term} onChange={e => {setFilter({...filter, term: e.target.value as any}); fetchData(true);}}>
                 {termsList.map(t => <option key={t} value={t}>{t} Term</option>)}
              </select>
           </div>
           {reportMode === 'MONTHLY' && (
             <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Month</label>
                <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.month} onChange={e => setFilter({...filter, month: e.target.value})}>
                   {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
             </div>
           )}
           <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade Cluster ({classes.length} Nodes Found)</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.gradeId} onChange={e => { setFilter({...filter, gradeId: e.target.value, selectedStudentId: '', subjectId: ''}); localStorage.setItem('marks_last_grade', e.target.value); }}>
                 <option value="">CHOOSE GRADE</option>
                 {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
           </div>
        </div>

        <div className="max-w-2xl mx-auto print:hidden space-y-3 relative">
           {isLoading && (
              <div className="absolute inset-x-0 -top-10 flex justify-center">
                 <span className="bg-black text-white px-4 py-1 rounded-full text-[8px] font-black uppercase animate-pulse">Syncing Unified Vault...</span>
              </div>
           )}
           {reportMode !== 'SUBJECT' ? (
             <select className="w-full bg-white border-4 border-black rounded-3xl px-8 py-5 font-black uppercase text-[11px] outline-none shadow-2xl text-black" value={filter.selectedStudentId} onChange={e => setFilter({...filter, selectedStudentId: e.target.value})}>
                <option value="">SELECT CANDIDATE ({studentList.length} PROFILES DETECTED)</option>
                {studentList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.rollNumber})</option>)}
             </select>
           ) : (
             <select className="w-full bg-white border-4 border-black rounded-3xl px-8 py-5 font-black uppercase text-[11px] outline-none shadow-2xl text-black" value={filter.subjectId} onChange={e => setFilter({...filter, subjectId: e.target.value})}>
                <option value="">SELECT SUBJECT MODULE ({availableSubjects.length} MODULES DETECTED)</option>
                {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
           )}
        </div>

        <div className="w-full pb-20">
           {reportMode === 'SUBJECT' ? (
              <div className="max-w-7xl mx-auto bg-white border-4 border-black rounded-[3rem] overflow-hidden shadow-2xl p-8">
                 <div className="text-center border-b-4 border-black pb-8 mb-8">
                    <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-black">{localStorage.getItem('schoolName') || PERMANENT_CONFIG.name}</h2>
                    <h3 className="text-sm font-black uppercase tracking-[0.4em] text-black mt-3">SUBJECT-WISE PERFORMANCE MATRIX</h3>
                    <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-10 mt-6">
                       <p className="text-[11px] font-black uppercase text-black">GRADE: {classes.find(c => c.id === filter.gradeId)?.name || 'N/A'}</p>
                       <p className="text-[11px] font-black uppercase text-black">MODULE: {subjects.find(s => s.id === filter.subjectId)?.name || 'N/A'}</p>
                    </div>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full border-collapse border-4 border-black text-black text-[10px] font-black uppercase min-w-[800px]">
                       <thead>
                          <tr className="bg-black text-white h-12">
                             <th className="border-r border-zinc-800 w-12 text-center">S#</th>
                             <th className="border-r border-zinc-800 text-left px-5">CANDIDATE IDENTITY</th>
                             {VDB.toCanonicalTerm(filter.term) === '1st' ? ['SEP', 'OCT', 'NOV'].map(m => <th key={m} className="border-r border-zinc-800 w-16">{m}</th>) : ['FEB', 'MAR', 'APR'].map(m => <th key={m} className="border-r border-zinc-800 w-16">{m}</th>)}
                             <th className="border-r border-zinc-800 w-16 bg-zinc-900">SUM</th>
                             <th className="border-r border-zinc-800 w-24">EXAM(100)</th>
                             <th className="border-r border-zinc-800 w-16 bg-zinc-900">AVG%</th>
                             <th className="w-12">GR</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y-2 border-black">
                          {subjectLedgerData.map((row, idx) => (
                             <tr key={idx} className="h-10 hover:bg-slate-50 border-b-2 border-black">
                                <td className="border-r-2 border-black text-center">#{idx + 1}</td>
                                <td className="border-r-2 border-black px-5">{row.student.name}</td>
                                {row.mScores.map((s, i) => <td key={i} className="border-r-2 border-black text-center">{s || 0}</td>)}
                                <td className="border-r-2 border-black text-center bg-slate-50">{row.sum}</td>
                                <td className="border-r-2 border-black text-center">{row.examObtained}</td>
                                <td className="border-r-2 border-black text-center bg-slate-50 font-black">{row.avgPct}%</td>
                                <td className="text-center font-black">{row.grade}</td>
                             </tr>
                          ))}
                          {subjectLedgerData.length === 0 && (
                             <tr><td colSpan={10} className="py-40 text-center text-zinc-300 tracking-[0.5em] font-black uppercase">Awaiting Parameters</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           ) : individualReportData ? (
             <div ref={reportRef} className="max-w-[850px] mx-auto bg-white border-4 border-black p-6 md:p-12 relative print:p-0 print:border-none text-black font-black shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)]">
               <div className="flex flex-col md:flex-row justify-between items-start mb-10 pb-8 border-b-4 border-black gap-6">
                  <div className="flex items-center gap-8">
                     <img src={logo} className="w-16 h-16 md:w-24 md:h-24 object-contain" alt="Logo" />
                     <div>
                        <h2 className="text-2xl md:text-4xl font-black text-black uppercase tracking-tighter leading-none">OFFICIAL TRANSCRIPT</h2>
                        <p className="text-[10px] md:text-[12px] font-black text-zinc-400 uppercase tracking-[0.4em] mt-3">{localStorage.getItem('schoolName') || PERMANENT_CONFIG.name}</p>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 border-4 border-black mb-10 bg-slate-50 uppercase text-[10px] md:text-[11px]">
                  <div className="border-r-4 border-black p-3 md:p-5 text-center border-b-4 md:border-b-0">
                     <p className="text-[8px] text-zinc-400 mb-2 font-black tracking-widest">SESSION</p>
                     {filter.year}
                  </div>
                  <div className="border-r-0 md:border-r-4 border-black p-3 md:p-5 text-center border-b-4 md:border-b-0">
                     <p className="text-[8px] text-zinc-400 mb-2 font-black tracking-widest">PERIOD</p>
                     {reportMode === 'MONTHLY' ? filter.month.toUpperCase() : filter.term + ' TERM'}
                  </div>
                  <div className="border-r-4 border-black p-3 md:p-5 text-center">
                     <p className="text-[8px] text-zinc-400 mb-2 font-black tracking-widest">GRADE</p>
                     {classes.find(c => c.id === individualReportData.student.gradeId)?.name || 'N/A'}
                  </div>
                  <div className="p-3 md:p-5 text-center">
                     <p className="text-[8px] text-zinc-400 mb-2 font-black tracking-widest">TEACHER</p>
                     <span className="truncate block">{individualReportData.teacher}</span>
                  </div>
               </div>

               <div className="mb-6 flex justify-between items-center px-2">
                  <h3 className="text-lg md:text-2xl font-black uppercase tracking-tight">{individualReportData.student.name}</h3>
                  <span className="text-[11px] md:text-[13px] font-black tracking-widest">ID: {individualReportData.student.rollNumber}</span>
               </div>

               <div className="border-4 border-black overflow-x-auto mb-12">
                  <table className="w-full border-collapse text-[10px] md:text-[12px] font-black uppercase text-black min-w-[600px]">
                     <thead>
                        <tr className="bg-black text-white h-12">
                           <th className="p-4 border-r border-zinc-800 text-left">SUBJECT MODULE</th>
                           {reportMode === 'TERM' ? (
                             <>
                                {individualReportData.testMonths?.map(m => <th key={m} className="p-2 border-r border-zinc-800 w-16">{m.substring(0,3)}</th>)}
                                <th className="p-2 border-r border-zinc-800 bg-zinc-900 w-16">SUM</th>
                                <th className="p-2 border-r border-zinc-800 w-24">EXAM</th>
                                <th className="p-2 border-r border-zinc-800 bg-zinc-900 w-16">AVG%</th>
                             </>
                           ) : (
                             <>
                                <th className="p-2 border-r border-zinc-800 w-16 text-center">MAX</th>
                                <th className="p-2 border-r border-zinc-800 w-24 text-center">OBTAINED</th>
                                <th className="p-2 border-r border-zinc-800 bg-zinc-900 w-16 text-center">%AGE</th>
                             </>
                           )}
                           <th className="p-2 w-12 text-center">GR</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y-2 border-black">
                        {individualReportData.rows.map((row: any, idx: number) => (
                          <tr key={idx} className="h-12 border-b-2 border-black last:border-b-0 hover:bg-slate-50">
                             <td className="p-4 border-r-2 border-black font-black">{row.name}</td>
                             {reportMode === 'TERM' ? (
                               <>
                                  {row.mScores.map((s: number, si: number) => <td key={si} className="text-center border-r-2 border-black">{s || 0}</td>)}
                                  <td className="text-center border-r-2 border-black bg-slate-50">{row.monthlyTotal}</td>
                                  <td className="text-center border-r-2 border-black">{row.examObtained}</td>
                                  <td className="text-center border-r-2 border-black bg-slate-50 font-black">{row.avgPct}%</td>
                               </>
                             ) : (
                               <>
                                  <td className="text-center border-r-2 border-black font-black">20</td>
                                  <td className="text-center border-r-2 border-black">{row.obtained}</td>
                                  <td className="text-center border-r-2 border-black bg-slate-50 font-black">{row.pct}%</td>
                               </>
                             )}
                             <td className="text-center font-black">{row.grade}</td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
                  <div className="border-4 border-black p-8 min-h-[160px] relative">
                     <p className="text-[9px] font-black text-zinc-400 mb-4 uppercase tracking-[0.3em]">Institutional Assessment</p>
                     <p className="text-[12px] italic leading-relaxed text-justify">
                        Candidate demonstrates consistent academic engagement within this cycle. Performance metrics signify satisfactory developmental trajectory in the assigned modules.
                     </p>
                  </div>
                  <div className="border-4 border-black overflow-hidden flex flex-col">
                     <div className="bg-black text-white p-3 text-[11px] text-center font-black tracking-widest uppercase">Attendance Audit</div>
                     <div className="flex-1 grid grid-cols-3 divide-x-2 divide-black text-center items-center h-full min-h-[100px]">
                        <div><p className="text-[8px] text-zinc-400 font-black mb-1 uppercase">WORKING</p><p className="text-xl md:text-2xl font-black">{individualReportData.attendance.working}</p></div>
                        <div><p className="text-[8px] text-emerald-600 font-black mb-1 uppercase">PRESENT</p><p className="text-xl md:text-2xl font-black text-emerald-600">{individualReportData.attendance.present}</p></div>
                        <div><p className="text-[8px] text-rose-600 font-black mb-1 uppercase">ABSENT</p><p className="text-xl md:text-2xl font-black text-rose-600">{individualReportData.attendance.absent}</p></div>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-10 md:gap-32 mt-24 px-4 md:px-10">
                  <div className="text-center border-t-4 border-black pt-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest">Class Teacher</div>
                  <div className="text-center border-t-4 border-black pt-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest">Principal Node</div>
               </div>
             </div>
           ) : (
             <div className="py-60 text-center opacity-20 uppercase tracking-[1em] text-[12px] font-black">
                SELECT CANDIDATE IDENTITY TO RETRIEVE TRANSCRIPT DATA
             </div>
           )}
        </div>
      </div>
      <style>{`
        select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
        option { color: black; font-weight: 900; background: white; }
      `}</style>
    </div>
  );
};

export default ReportCards;
