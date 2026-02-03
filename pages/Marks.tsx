
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Subject, Mark, ClassLevel, TestType, Teacher, Student } from '../types.ts';
import { autoSave, getActiveSessionYear, getActiveTerm, loadData, saveData, setActiveSessionYear, setActiveTerm } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

/**
 * SEEDS ACADEMIC LEDGER v6.0
 * MISSION: UNIFIED LEDGER MARK ENTRY & TEMPORAL CONSISTENCY
 */
const Marks: React.FC = () => {
  const navigate = useNavigate();
  const [syncState, setSyncState] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SUCCESS'>('IDLE');
  
  const years = ["2023-2024", "2024-2025", "2025-2026", "2026-2027", "2027-2028"];
  const termsList = ["1st", "2nd"];

  const [filter, setFilter] = useState({
    year: VDB.toCanonicalYear(getActiveSessionYear()),
    term: getActiveTerm() as '1st' | '2nd',
    gradeId: localStorage.getItem('marks_last_grade') || '',
    subjectId: '',
    teacherId: ''
  });

  // REACTIVE INFRASTRUCTURE: Directly from VDB to ensure zero-latency visibility
  const classes = useMemo(() => VDB.queryAll<ClassLevel>('classes'), [syncState]);
  const subjects = useMemo(() => VDB.queryAll<Subject>('subjects'), [syncState]);
  const teachers = useMemo(() => VDB.queryAll<Teacher>('teachers'), [syncState]);

  const termMonths = useMemo(() => {
    return filter.term === '1st' ? ['September', 'October', 'November'] : ['February', 'March', 'April'];
  }, [filter.term]);

  const syncUIFromVault = useCallback(() => {
    setSyncState(VDB.syncCounter);
    
    // Node Validation: Snap to valid class if selection is missing
    const allGrades = VDB.queryAll<ClassLevel>('classes');
    if (allGrades.length > 0 && !filter.gradeId) {
      const defaultClass = allGrades[0].id;
      localStorage.setItem('marks_last_grade', defaultClass);
      setFilter(prev => ({ ...prev, gradeId: defaultClass }));
    }
  }, [filter.gradeId]);

  const fetchData = useCallback(async (force: boolean = false) => {
    setIsLoading(true);
    try {
      setActiveSessionYear(filter.year);
      setActiveTerm(filter.term);

      // Unified Fetch
      await loadData('identity', force);
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
  }, [filter.year, filter.term, syncUIFromVault]);

  const filteredStudents = useMemo(() => {
    if (!filter.gradeId) return [];
    return VDB.getStudentsByClass(filter.gradeId);
  }, [filter.gradeId, syncState]);

  const availableSubjects = useMemo(() => {
    const normalizedGradeId = VDB.normalize(filter.gradeId);
    return subjects.filter(s => VDB.normalize(s.gradeId) === normalizedGradeId);
  }, [subjects, filter.gradeId, syncState]);

  const calculateDerivedMarks = useCallback((studentId: string) => {
    if (!filter.subjectId) {
       return { mScores: [null, null, null], savedSum: 0, marksIn60: 0, testPercentage: 0, examRawValue: '', examPercentage: 0, avgPercentage: 0, grade: '-' };
    }

    const allMarks = VDB.queryAll<Mark>('marks');
    const normalizedSubId = VDB.normalize(filter.subjectId);
    const normalizedStuId = VDB.normalize(studentId);
    const cYear = VDB.toCanonicalYear(filter.year);
    const cTerm = VDB.toCanonicalTerm(filter.term);
    
    const studentMarks = allMarks.filter(m => 
      VDB.normalize(m.studentId) === normalizedStuId && 
      VDB.normalize(m.subjectId) === normalizedSubId && 
      VDB.toCanonicalYear(m.yearId) === cYear &&
      m.termId === cTerm
    );

    const mScores = termMonths.map(mName => {
      const mark = studentMarks.find(m => 
        m.testType === TestType.MONTHLY && 
        VDB.toCanonicalMonth(m.month) === VDB.toCanonicalMonth(mName)
      );
      if (!mark || mark.marksObtained === 'A' || mark.marksObtained === '') return null;
      const val = parseFloat(String(mark.marksObtained));
      return isNaN(val) ? null : val;
    });

    const activeScores = mScores.filter(s => s !== null) as number[];
    const savedSum = activeScores.reduce((a, b) => a + b, 0);
    
    let marksIn60 = 0;
    if (activeScores.length === 3) marksIn60 = savedSum;
    else if (activeScores.length === 2) marksIn60 = (savedSum / 40) * 60;
    else if (activeScores.length === 1) marksIn60 = (activeScores[0] / 20) * 60;

    const testPercentage = (marksIn60 / 60) * 100;
    const examMarkObj = studentMarks.find(m => m.testType === TestType.EXAM);
    const examRaw = examMarkObj?.marksObtained;
    const examMarks = (examRaw === 'A' || examRaw === '' || examRaw === undefined) ? 0 : parseFloat(String(examRaw));
    const examPercentage = (examMarks / 100) * 100;
    
    const avgPercentage = activeScores.length > 0 ? (testPercentage + examPercentage) / 2 : examPercentage;

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
      mScores,
      savedSum,
      marksIn60: Number(marksIn60.toFixed(1)),
      testPercentage: Number(testPercentage.toFixed(1)),
      examRawValue: (examRaw === 'A' || examRaw === undefined) ? examRaw || '' : examRaw,
      examPercentage: Number(examPercentage.toFixed(1)),
      avgPercentage: Number(avgPercentage.toFixed(1)),
      grade: getGrade(avgPercentage)
    };
  }, [filter, termMonths, syncState]);

  const handleEntry = async (studentId: string, month: string, type: TestType, val: string) => {
    if (!filter.subjectId) return;
    const normalizedVal = val.toUpperCase().trim();
    if (normalizedVal !== '' && normalizedVal !== 'A') {
      const numericVal = parseFloat(normalizedVal);
      if (!isNaN(numericVal)) {
        if (type === TestType.MONTHLY && numericVal > 20) return;
        if (type === TestType.EXAM && numericVal > 100) return;
      }
    }
    const cYear = VDB.toCanonicalYear(filter.year);
    const cTerm = VDB.toCanonicalTerm(filter.term);
    const cMonth = type === TestType.EXAM ? '' : VDB.toCanonicalMonth(month);
    
    const deterministicId = `MARK_${studentId}_${filter.subjectId}_${type}_${cMonth || 'EXAM'}_${cYear}_${cTerm}`;
    
    VDB.populateTable('marks', [{
        id: deterministicId,
        yearId: cYear,
        termId: cTerm,
        studentId,
        subjectId: filter.subjectId,
        month: cMonth,
        testType: type,
        marksObtained: normalizedVal,
        totalMarks: type === TestType.MONTHLY ? 20 : 100,
        date: new Date().toLocaleDateString(),
        teacherId: filter.teacherId
    }], false);
    
    setSyncState(v => v + 1);
    autoSave('marks', VDB.queryAll('marks'));
  };

  const handleManualSave = async () => {
    if (saveStatus === 'SAVING') return;
    setSaveStatus('SAVING');
    const success = await saveData('marks', VDB.queryAll<Mark>('marks'));
    if (success) { setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 3000); }
    else { setSaveStatus('IDLE'); }
  };

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-40 selection:bg-black selection:text-white">
      <div className="bg-white border-b-4 border-black p-3 sticky top-0 z-[100] print:hidden shadow-lg">
        <div className="w-full flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
             <img src={logo} className="w-12 h-12 object-contain" alt="SEEDS" />
             <div>
                <h1 className="text-xl font-black uppercase tracking-tighter text-black leading-none">Academic Ledger</h1>
                <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mt-1">Session {filter.year} • {filter.term} Term</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => fetchData(true)} className="w-10 h-10 bg-slate-100 border-2 border-black rounded-xl flex items-center justify-center text-xs hover:bg-black hover:text-white transition-all"><i className="fas fa-sync-alt"></i></button>
             <button onClick={handleManualSave} disabled={isLoading} className={`px-7 py-2 rounded-xl text-[10px] font-black uppercase border-2 border-black shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all ${saveStatus === 'SUCCESS' ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-50'}`}>
                {saveStatus === 'SAVING' ? 'SYNCING...' : 'COMMIT LEDGER'}
             </button>
             <button onClick={() => navigate('/')} className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center text-xs shadow-lg hover:scale-105 transition-all"><i className="fas fa-home"></i></button>
          </div>
        </div>
      </div>

      <div className="w-full p-4 space-y-6">
        <div className="w-full bg-white border-4 border-black p-6 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-5 gap-4 print:hidden shadow-xl">
           <div className="space-y-1.5 text-black">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Session</label>
              <select className="w-full bg-white border-2 border-black rounded-xl px-3 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.year} onChange={e => {setFilter({...filter, year: e.target.value}); fetchData(true);}}>
                 {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
           </div>
           <div className="space-y-1.5 text-black">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Term</label>
              <select className="w-full bg-white border-2 border-black rounded-xl px-3 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.term} onChange={e => {setFilter({...filter, term: e.target.value as any}); fetchData(true);}}>
                 {termsList.map(t => <option key={t} value={t}>{t} Term</option>)}
              </select>
           </div>
           <div className="space-y-1.5 text-black">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade Cluster Node</label>
              <select className="w-full bg-white border-2 border-black rounded-xl px-3 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.gradeId} onChange={e => {setFilter({...filter, gradeId: e.target.value, subjectId: ''}); localStorage.setItem('marks_last_grade', e.target.value);}}>
                 <option value="">SELECT GRADE ({classes.length} NODES FOUND)</option>
                 {classes.map(c => <option key={c.id} value={c.id}>{String(c.name)}</option>)}
              </select>
           </div>
           <div className="space-y-1.5 text-black">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Module</label>
              <select className="w-full bg-white border-2 border-black rounded-xl px-3 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.subjectId} onChange={e => setFilter({...filter, subjectId: e.target.value})}>
                 <option value="">CHOOSE SUBJECT ({availableSubjects.length} NODES)</option>
                 {availableSubjects.map(s => <option key={s.id} value={s.id}>{String(s.name)}</option>)}
              </select>
           </div>
           <div className="space-y-1.5 text-black">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Faculty Node</label>
              <select className="w-full bg-white border-2 border-black rounded-xl px-3 py-2 text-[10px] font-black uppercase outline-none text-black" value={filter.teacherId} onChange={e => setFilter({...filter, teacherId: e.target.value})}>
                 <option value="">CHOOSE TEACHER ({teachers.length} NODES)</option>
                 {teachers.map(t => <option key={t.id} value={t.id}>{String(t.name)}</option>)}
              </select>
           </div>
        </div>

        <div className="w-full bg-white border-4 border-black rounded-[3rem] overflow-hidden relative shadow-2xl min-h-[500px]">
           {isLoading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-[80] flex flex-col items-center justify-center">
                 <i className="fas fa-sync fa-spin text-5xl text-black mb-4"></i>
                 <p className="text-[10px] font-black uppercase tracking-[0.4em]">Partitioning Unified Ledger...</p>
              </div>
           )}
           {!filter.subjectId ? (
             <div className="flex flex-col items-center justify-center py-48 text-center px-10">
                <i className="fas fa-fingerprint text-6xl mb-6 text-zinc-100"></i>
                <p className="text-[14px] font-black uppercase tracking-[0.4em] text-black">Ledger Locked</p>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-2">Initialize Grade & Module nodes to access the vault</p>
             </div>
           ) : (
             <div className="w-full overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse min-w-[1000px]">
                   <thead>
                      <tr className="bg-black text-white text-[9px] font-black uppercase border-b-4 border-black">
                         <th rowSpan={2} className="p-5 border-r border-zinc-800 w-16 text-center">S#</th>
                         <th rowSpan={2} className="p-5 border-r border-zinc-800 text-left min-w-[240px]">Candidate Profile</th>
                         <th colSpan={3} className="p-4 border-r border-zinc-800 text-center bg-zinc-900">Assessment Cycle ({filter.term})</th>
                         <th rowSpan={2} className="p-4 border-r border-zinc-800 w-16 text-center">Sum</th>
                         <th rowSpan={2} className="p-4 border-r border-zinc-800 w-20 text-center bg-zinc-900">T(60)</th>
                         <th rowSpan={2} className="p-4 border-r border-zinc-800 w-20 text-center">%Test</th>
                         <th rowSpan={2} className="p-4 border-r border-zinc-800 w-24 text-center">Exam(100)</th>
                         <th rowSpan={2} className="p-4 border-r border-zinc-800 w-20 text-center">%Exam</th>
                         <th rowSpan={2} className="p-4 border-r border-zinc-800 w-20 text-center bg-zinc-900">Avg%</th>
                         <th rowSpan={2} className="p-4 w-16 text-center">Grade</th>
                      </tr>
                      <tr className="bg-zinc-950 text-white text-[8px] font-black uppercase border-b-2 border-black">
                         {termMonths.map(m => (
                           <th key={m} className="p-2 border-r border-zinc-800 text-center w-20">{m.substring(0,3)}</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-200 text-black bg-white">
                      {filteredStudents.map((s, idx) => {
                        const derived = calculateDerivedMarks(s.id);
                        return (
                          <tr key={s.id} className="hover:bg-zinc-50 h-12 transition-colors">
                             <td className="border-r border-zinc-200 text-center text-[11px] font-black text-black">#{idx + 1}</td>
                             <td className="border-r border-zinc-200 px-5 text-[12px] font-black uppercase text-black truncate">{String(s.name)}</td>
                             {termMonths.map((m, mIdx) => (
                               <td key={m} className="border-r border-zinc-200 p-0">
                                  <input 
                                    type="text" 
                                    className="w-full h-12 bg-transparent text-center font-black text-[11px] outline-none text-black hover:bg-zinc-100 transition-colors" 
                                    value={derived.mScores[mIdx] === null ? '' : derived.mScores[mIdx]} 
                                    onChange={e => handleEntry(s.id, m, TestType.MONTHLY, e.target.value)}
                                    placeholder="-"
                                  />
                               </td>
                             ))}
                             <td className="border-r border-zinc-200 text-center text-[11px] font-black text-black">{derived.savedSum}</td>
                             <td className="border-r border-zinc-200 text-center text-[11px] font-black bg-zinc-50 text-black">{derived.marksIn60}</td>
                             <td className="border-r border-zinc-200 text-center text-[11px] font-black text-black">{derived.testPercentage}%</td>
                             <td className="border-r border-zinc-200 p-0">
                                <input 
                                  type="text" 
                                  className="w-full h-12 bg-transparent text-center font-black text-[11px] outline-none text-black hover:bg-zinc-100 transition-colors" 
                                  value={derived.examRawValue} 
                                  onChange={e => handleEntry(s.id, '', TestType.EXAM, e.target.value)}
                                  placeholder="0"
                                />
                             </td>
                             <td className="border-r border-zinc-200 text-center text-[11px] font-black text-black">{derived.examPercentage}%</td>
                             <td className="border-r border-zinc-200 text-center text-[12px] font-black bg-zinc-50 text-black">{derived.avgPercentage}%</td>
                             <td className="text-center font-black text-black">{derived.grade}</td>
                          </tr>
                        );
                      })}
                   </tbody>
                </table>
             </div>
           )}
        </div>
      </div>
      <style>{`
        .custom-scrollbar { height: 16px; width: 16px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #fff; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border: 4px solid #fff; }
        select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        option { color: black; font-weight: 900; }
      `}</style>
    </div>
  );
};

export default Marks;
