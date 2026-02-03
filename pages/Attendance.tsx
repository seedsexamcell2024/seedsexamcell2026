
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Student, ClassLevel } from '../types.ts';
import { loadData, saveData, getActiveSessionYear, autoSave, getPKTDateString, getPKTDisplayDate } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

const Attendance = () => {
  const navigate = useNavigate();
  const activeYear = getActiveSessionYear();
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SUCCESS'>('IDLE');
  const [dataVersion, setDataVersion] = useState(0);

  const [selectedDate, setSelectedDate] = useState(getPKTDateString());
  const [selectedGradeId, setSelectedGradeId] = useState(localStorage.getItem('attendance_last_grade') || '');

  const displayDateLabel = useMemo(() => getPKTDisplayDate(selectedDate), [selectedDate]);
  const isWeekend = useMemo(() => VDB.isWeekend(selectedDate), [selectedDate]);

  const syncUIFromVault = useCallback(() => {
    setClasses(VDB.queryAll('classes'));
    setDataVersion(v => v + 1);
  }, []);

  const fetchData = useCallback(async (force: boolean = false) => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadData('classes', force),
        loadData('students', force),
        loadData('attendance', true)
      ]);
      syncUIFromVault();
    } finally {
      setIsLoading(false);
    }
  }, [syncUIFromVault]);

  useEffect(() => {
    fetchData();
    window.addEventListener('DATA_UPDATED', syncUIFromVault);
    window.addEventListener('BOOT_COMPLETE', syncUIFromVault);
    return () => {
      window.removeEventListener('DATA_UPDATED', syncUIFromVault);
      window.removeEventListener('BOOT_COMPLETE', syncUIFromVault);
    };
  }, [fetchData, syncUIFromVault]);

  const shiftDate = (days: number) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + days);
    const newDateStr = VDB.normalizeDateString(current.toISOString());
    setSelectedDate(newDateStr);
    fetchData(true);
  };

  const jumpToToday = () => {
    const today = getPKTDateString();
    setSelectedDate(today);
    fetchData(true);
  };

  // ABSOLUTE REGISTRY LOOKUP: Uses VDB.getStudentsByClass for normalized matching
  const activeRoster = useMemo(() => {
    if (!selectedGradeId) return [];
    return VDB.getStudentsByClass(selectedGradeId);
  }, [selectedGradeId, dataVersion]);

  const getStatus = (studentId: string) => VDB.getAttendanceStatus(studentId, selectedDate);

  const markStatus = async (studentId: string, status: string) => {
    if (isWeekend) return;
    const current = getStatus(studentId);
    const next = current === status ? '-' : status;
    const monthNum = parseInt(selectedDate.split('-')[1]);
    const term = (monthNum >= 1 && monthNum <= 6) ? '2nd' : '1st';
    VDB.populateTable('attendance', [{ studentId, date: selectedDate, status: next, yearId: activeYear, termId: term }]);
    setDataVersion(v => v + 1);
    autoSave('attendance', VDB.getFlatAttendance());
  };

  const commitRegistry = async () => {
    if (activeRoster.length === 0) return;
    setSaveStatus('SAVING');
    const success = await saveData('attendance', VDB.getFlatAttendance());
    if (success) {
      setSaveStatus('SUCCESS');
      setTimeout(() => setSaveStatus('IDLE'), 3000);
    } else { setSaveStatus('IDLE'); }
  };

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-40">
      <div className="bg-white border-b-4 border-black p-4 sticky top-0 z-[100] shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
             <img src={logo} className="w-12 h-12 object-contain" alt="Logo" />
             <div>
                <h1 className="text-xl font-black uppercase tracking-tighter text-black leading-none">Attendance Registry</h1>
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">Direct Vault Access • Forensic Registry</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={commitRegistry} disabled={isLoading || activeRoster.length === 0 || isWeekend} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all ${saveStatus === 'SUCCESS' ? 'bg-emerald-500 text-white border-emerald-600 shadow-none' : 'bg-white hover:bg-black hover:text-white'}`}>
                <i className={`fas ${saveStatus === 'SAVING' ? 'fa-sync fa-spin' : saveStatus === 'SUCCESS' ? 'fa-check' : 'fa-save'} mr-2`}></i>
                {saveStatus === 'SAVING' ? 'COMMITTING...' : saveStatus === 'SUCCESS' ? 'RECORD SECURED' : 'COMMIT VAULT'}
             </button>
             <button onClick={() => navigate('/')} className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all"><i className="fas fa-home"></i></button>
          </div>
        </div>
      </div>
      <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
        <div className="bg-white border-4 border-black p-8 rounded-[2.5rem] shadow-xl space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade Cluster Node</label>
                 <select className="w-full bg-slate-50 border-2 border-black rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none" value={selectedGradeId} onChange={e => {setSelectedGradeId(e.target.value); localStorage.setItem('attendance_last_grade', e.target.value);}}>
                    <option value="">SELECT CLASS</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Temporal Node</label>
                 <div className="flex items-center gap-2">
                    <button onClick={() => shiftDate(-1)} className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 shadow-lg active:scale-95 transition-all"><i className="fas fa-chevron-left"></i></button>
                    <div className="flex-1 relative group">
                      <input type="date" className={`w-full bg-slate-50 border-2 border-black rounded-2xl px-4 py-4 text-sm font-black outline-none transition-all cursor-pointer ${isWeekend ? 'text-rose-600' : 'text-black'}`} value={selectedDate} onChange={e => { setSelectedDate(e.target.value); fetchData(true); }} />
                      <button onClick={jumpToToday} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black text-white text-[8px] font-black uppercase px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">Today</button>
                    </div>
                    <button onClick={() => shiftDate(1)} className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 shadow-lg active:scale-95 transition-all"><i className="fas fa-chevron-right"></i></button>
                 </div>
              </div>
           </div>
        </div>
        <div key={selectedDate} className="bg-white border-4 border-black rounded-[3rem] overflow-hidden shadow-2xl relative min-h-[500px]">
           {isLoading && (
             <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-[101] flex flex-col items-center justify-center">
                <i className="fas fa-sync-alt fa-spin text-5xl text-black mb-4"></i>
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Deep Sweep Extraction...</p>
             </div>
           )}
           {isWeekend ? (
             <div className="flex flex-col items-center justify-center py-40 space-y-6">
                <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center text-4xl shadow-inner border border-rose-100"><i className="fas fa-calendar-times"></i></div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-black text-black uppercase tracking-widest">Weekend Lock</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">{displayDateLabel}</p>
                </div>
                <button onClick={() => shiftDate(1)} className="px-8 py-3 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Next Weekday</button>
             </div>
           ) : (
             <div className="divide-y-2 divide-slate-50">
               <div className="bg-black p-6 flex justify-between items-center text-white">
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">{displayDateLabel}</span>
                    <div className="h-1 w-1 rounded-full bg-emerald-500"></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase">{selectedDate}</span>
                  </div>
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{activeRoster.length} Nodes</span>
               </div>
               {activeRoster.map((s, idx) => {
                 const status = getStatus(s.id);
                 return (
                   <div key={s.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
                      <div className="flex items-center gap-6">
                        <span className="text-[10px] font-black text-slate-300 w-8">#{idx + 1}</span>
                        <div>
                          <h3 className="text-base font-black uppercase text-slate-950 leading-none">{s.name}</h3>
                          <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{s.rollNumber}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {[{ code: 'P', label: 'Present' }, { code: 'A', label: 'Absent' }, { code: 'H', label: 'Holiday' }].map(type => (
                          <button key={type.code} onClick={() => markStatus(s.id, type.code)} className={`w-14 h-14 rounded-2xl border-2 font-black transition-all flex flex-col items-center justify-center ${status === type.code ? 'bg-black border-transparent text-white shadow-lg' : 'bg-white border-slate-200 text-slate-300'}`}>
                             <span className="text-sm">{type.code}</span>
                             <span className="text-[6px] uppercase opacity-60">{type.label}</span>
                          </button>
                        ))}
                      </div>
                   </div>
                 );
               })}
               {activeRoster.length === 0 && !isLoading && (
                 <div className="py-40 text-center">
                    <i className="fas fa-folder-open text-6xl text-slate-100 mb-6"></i>
                    <p className="text-[12px] font-black uppercase tracking-[0.5em] text-slate-300">No Candidates in Grade</p>
                 </div>
               )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Attendance;
