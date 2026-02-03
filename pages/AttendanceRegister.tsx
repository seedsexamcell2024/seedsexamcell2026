
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Student, ClassLevel } from '../types.ts';
import { loadData, saveData, autoSave, getActiveTerm, getActiveSessionYear, setActiveSessionYear, setActiveTerm } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

/**
 * SEEDS ATTENDANCE MATRIX v6.0
 * MISSION: UNIFIED LEDGER INTEGRITY & NODE PRECISION
 */
const AttendanceRegister = () => {
  const navigate = useNavigate();
  const [syncState, setSyncState] = useState(0); // Driven by VDB.syncCounter
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SUCCESS'>('IDLE');
  
  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const yearsList = ["2023-2024", "2024-2025", "2025-2026", "2026-2027", "2027-2028"];
  const terms = ["1st", "2nd"];

  const [filter, setFilter] = useState({
    year: VDB.toCanonicalYear(getActiveSessionYear()), 
    gradeId: localStorage.getItem('attendance_last_grade') || '',
    month: VDB.toCanonicalMonth(new Date().toLocaleString('en-US', { month: 'long' })),
    term: getActiveTerm()
  });

  // Pull nodes directly from VDB - React will re-calculate this when syncState changes
  const classes = useMemo(() => VDB.queryAll<ClassLevel>('classes'), [syncState]);

  const syncUIFromVault = useCallback(() => {
    setSyncState(VDB.syncCounter);
    
    // Dynamic Validation: If the registry just arrived and nothing is selected, snap to the first class
    const allGradeNodes = VDB.queryAll<ClassLevel>('classes');
    if (allGradeNodes.length > 0 && !filter.gradeId) {
      const firstId = allGradeNodes[0].id;
      localStorage.setItem('attendance_last_grade', firstId);
      setFilter(prev => ({ ...prev, gradeId: firstId }));
    }
  }, [filter.gradeId]);

  const fetchData = useCallback(async (force: boolean = false) => {
    setIsLoading(true);
    try {
      setActiveSessionYear(filter.year);
      setActiveTerm(filter.term);
      
      // Pull entire MASTER_VAULT
      await loadData('identity', force); 
      syncUIFromVault();
    } catch (err) {
      console.error("Registry Sync Failure:", err);
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

  const mIdx = useMemo(() => monthsList.indexOf(filter.month), [filter.month]);
  const calendarYear = useMemo(() => {
    const sessionStartYear = parseInt(filter.year.split('-')[0]) || 2024;
    return (mIdx >= 0 && mIdx <= 5) ? sessionStartYear + 1 : sessionStartYear;
  }, [mIdx, filter.year]);

  const daysInMonth = useMemo(() => {
    if (mIdx < 0) return [];
    try {
      const dateCount = new Date(calendarYear, mIdx + 1, 0).getDate();
      return Array.from({ length: dateCount }, (_, i) => {
        const dayNum = i + 1;
        const dateStr = `${calendarYear}-${String(mIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const dateObj = new Date(calendarYear, mIdx, dayNum);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        return { dayNum, isWeekend: VDB.isWeekend(dateStr), dateStr, dayName };
      });
    } catch (e) { return []; }
  }, [mIdx, calendarYear]);

  const activeRoster = useMemo(() => {
    if (!filter.gradeId) return [];
    return VDB.getStudentsByClass(filter.gradeId);
  }, [filter.gradeId, syncState]);

  const handleEntry = (studentId: string, dateStr: string, status: string) => {
    if (VDB.isWeekend(dateStr)) return;
    VDB.populateTable('attendance', [{ 
        studentId, 
        date: dateStr, 
        status, 
        yearId: VDB.toCanonicalYear(filter.year), 
        termId: VDB.toCanonicalTerm(filter.term)
    }]);
    setSyncState(v => v + 1);
    autoSave('attendance', VDB.getFlatAttendance());
  };

  const handleManualSave = async () => {
    if (saveStatus === 'SAVING') return;
    setSaveStatus('SAVING');
    const success = await saveData('attendance', VDB.getFlatAttendance());
    if (success) { 
      setSaveStatus('SUCCESS'); 
      setTimeout(() => setSaveStatus('IDLE'), 3000); 
    } else { 
      setSaveStatus('IDLE'); 
    }
  };

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-black selection:text-white">
      <div className="bg-white border-b-4 border-black p-3 sticky top-0 z-[100] print:hidden shadow-lg">
        <div className="w-full flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
             <img src={logo} className="w-12 h-12 object-contain" alt="SEEDS" />
             <div>
                <h1 className="text-xl font-black uppercase tracking-tighter text-black leading-none">Attendance Matrix</h1>
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                   {filter.month} {calendarYear} • Session {filter.year}
                </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => fetchData(true)} className="w-10 h-10 bg-slate-100 border-2 border-black rounded-xl flex items-center justify-center text-xs hover:bg-black hover:text-white transition-all"><i className="fas fa-sync-alt"></i></button>
             <button onClick={handleManualSave} disabled={isLoading} className={`px-7 py-2 rounded-xl text-[10px] font-black uppercase border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all ${saveStatus === 'SUCCESS' ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-50'}`}>
                {saveStatus === 'SAVING' ? 'SYNCING...' : 'COMMIT DATA'}
             </button>
             <button onClick={() => navigate('/')} className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-all"><i className="fas fa-home"></i></button>
          </div>
        </div>
      </div>

      <div className="w-full p-4 space-y-6">
        <div className="w-full bg-white border-4 border-black p-6 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden shadow-xl items-center">
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Session</label>
              <select className="w-full bg-white border-2 border-black rounded-2xl px-4 py-3 text-[11px] font-black uppercase outline-none text-black" value={filter.year} onChange={e => { setFilter({...filter, year: e.target.value}); fetchData(true); }}>
                 {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Term</label>
              <select className="w-full bg-white border-2 border-black rounded-2xl px-4 py-3 text-[11px] font-black uppercase outline-none text-black" value={filter.term} onChange={e => { setFilter({...filter, term: e.target.value as any}); fetchData(true); }}>
                 {terms.map(t => <option key={t} value={t}>{t} Term</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade Cluster Node</label>
              <select className="w-full bg-white border-2 border-black rounded-2xl px-4 py-3 text-[11px] font-black uppercase outline-none text-black" value={filter.gradeId} onChange={e => { setFilter({...filter, gradeId: e.target.value}); localStorage.setItem('attendance_last_grade', e.target.value); }}>
                 <option value="">SELECT GRADE ({classes.length} NODES FOUND)</option>
                 {classes.map(c => <option key={c.id} value={c.id}>{String(c.name)}</option>)}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Audit Month</label>
              <select className="w-full bg-white border-2 border-black rounded-2xl px-4 py-3 text-[11px] font-black uppercase outline-none text-black" value={filter.month} onChange={e => setFilter({...filter, month: e.target.value})}>
                 {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
           </div>
        </div>

        <div className="w-full bg-white border-4 border-black rounded-[3rem] overflow-hidden relative shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] min-h-[400px]">
           {isLoading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-[80] flex flex-col items-center justify-center">
                 <i className="fas fa-sync fa-spin text-5xl text-black mb-4"></i>
                 <p className="text-[10px] font-black uppercase tracking-[0.4em]">Deciphering Unified Ledger...</p>
              </div>
           )}
           <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse min-w-max">
                 <thead>
                    <tr className="bg-black text-white text-[9px] font-black uppercase border-b-4 border-black">
                       <th rowSpan={2} className="p-5 border-r border-zinc-800 w-16 text-center sticky left-0 bg-black z-[60]">S#</th>
                       <th rowSpan={2} className="p-5 border-r border-zinc-800 text-left min-w-[240px] sticky left-16 bg-black z-[60] shadow-2xl">Candidate Identity</th>
                       {daysInMonth.map(d => (
                         <th key={d.dateStr} className={`p-3 border-r border-zinc-800 text-center w-14 ${d.isWeekend ? 'bg-zinc-900 text-zinc-500' : 'bg-black'}`}>
                            <div className="text-[7px] opacity-60 mb-0.5">{d.dayName}</div>
                            <div className="text-[12px]">{String(d.dayNum)}</div>
                         </th>
                       ))}
                       <th colSpan={4} className="p-3 border-l-2 border-white bg-zinc-950 text-white text-[9px] text-center w-48">Registry Statistics</th>
                    </tr>
                    <tr className="bg-zinc-950 text-white text-[8px] font-black uppercase border-b-2 border-black">
                       {daysInMonth.map(d => (
                         <th key={`sub-${d.dateStr}`} className={`p-1 border-r border-zinc-800 text-center ${d.isWeekend ? 'bg-black text-zinc-700' : ''}`}>
                           {d.isWeekend ? 'OFF' : 'D'}
                         </th>
                       ))}
                       <th className="border-r border-zinc-800 w-12 bg-black">P</th>
                       <th className="border-r border-zinc-800 w-12 bg-black">A</th>
                       <th className="border-r border-zinc-800 w-12 bg-black">W</th>
                       <th className="w-12 bg-black">H</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-200 text-black bg-white">
                    {activeRoster.map((s, idx) => {
                      let pCount = 0, aCount = 0, hCount = 0;
                      daysInMonth.forEach(d => {
                        if (d.isWeekend) return;
                        const status = VDB.getAttendanceStatus(s.id, d.dateStr);
                        if (status === 'P') pCount++;
                        else if (status === 'A') aCount++;
                        else if (status === 'H') hCount++;
                      });
                      const workingDays = pCount + aCount;

                      return (
                        <tr key={s.id} className="hover:bg-zinc-50 group">
                           <td className="border-r border-zinc-200 text-center text-[11px] font-black bg-white sticky left-0 z-50 group-hover:bg-zinc-50 text-black">#{idx + 1}</td>
                           <td className="border-r border-zinc-200 px-5 py-4 text-[12px] font-black uppercase bg-white sticky left-16 z-50 shadow-sm group-hover:bg-zinc-50 text-black">
                              <span className="truncate block max-w-[200px]">{String(s.name)}</span>
                              <p className="text-[8px] text-zinc-400 mt-1">{s.rollNumber}</p>
                           </td>
                           {daysInMonth.map(d => {
                             const status = d.isWeekend ? '-' : VDB.getAttendanceStatus(s.id, d.dateStr);
                             return (
                               <td key={`${s.id}-${d.dateStr}`} className={`p-0 border-r border-zinc-100 text-center w-14 ${d.isWeekend ? 'bg-zinc-50/80' : ''}`}>
                                  <select 
                                    className={`w-full h-12 bg-transparent text-center font-black text-[11px] outline-none appearance-none cursor-pointer transition-all text-black ${d.isWeekend ? 'pointer-events-none opacity-20' : 'hover:bg-zinc-50'}`} 
                                    value={status} 
                                    disabled={d.isWeekend} 
                                    onChange={e => handleEntry(s.id, d.dateStr, e.target.value)}
                                  >
                                     <option value="-">-</option>
                                     {!d.isWeekend && (
                                       <>
                                         <option value="P" className="font-black text-black">P</option>
                                         <option value="A" className="font-black text-black">A</option>
                                         <option value="H" className="font-black text-black">H</option>
                                       </>
                                     )}
                                  </select>
                               </td>
                             );
                           })}
                           <td className="border-r border-zinc-200 text-center text-[11px] font-black bg-white group-hover:bg-zinc-50 text-black">{pCount}</td>
                           <td className="border-r border-zinc-200 text-center text-[11px] font-black bg-white group-hover:bg-zinc-50 text-black">{aCount}</td>
                           <td className="border-r border-zinc-200 text-center text-[11px] font-black bg-zinc-50 group-hover:bg-zinc-100 text-black">{workingDays}</td>
                           <td className="text-center text-[11px] font-black bg-white group-hover:bg-zinc-50 text-black">{hCount}</td>
                        </tr>
                      );
                    })}
                    {activeRoster.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={daysInMonth.length + 6} className="py-48 text-center bg-white">
                           <div className="flex flex-col items-center justify-center space-y-6">
                              <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-200 border-2 border-dashed border-zinc-200">
                                 <i className="fas fa-database text-5xl"></i>
                              </div>
                              <div className="space-y-2">
                                <p className="text-[14px] font-black uppercase tracking-[0.4em] text-black">Registry Empty</p>
                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Ensure Students are enrolled for Session {filter.year}</p>
                              </div>
                           </div>
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
        .custom-scrollbar::-webkit-scrollbar-track { background: #fff; border-radius: 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border: 4px solid #fff; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        table { border-spacing: 0; }
        th, td { white-space: nowrap; }
        select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
        option { color: black !important; background: white !important; font-weight: 900 !important; }
      `}</style>
    </div>
  );
};

export default AttendanceRegister;
