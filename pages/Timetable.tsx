
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClassLevel, Teacher, Subject, TimetableEntry, PeriodTiming } from '../types.ts';
import { loadData, saveData, getActiveSessionYear, getActiveTerm } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_PERIODS = ['1st', '2nd', '3rd', '4th', 'Break', '5th', '6th', '7th', '8th'];

const Timetable = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('session_role');
  const isAdmin = userRole === 'ADMIN';

  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [periodTimings, setPeriodTimings] = useState<PeriodTiming[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [isTimingEdit, setIsTimingEdit] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ day: string, periodIndex: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SUCCESS'>('IDLE');

  const activeYear = getActiveSessionYear();
  const activeTerm = getActiveTerm() as any;

  const fetchRegistry = useCallback(async (force: boolean = false) => {
    await Promise.all([
      loadData('classes', force),
      loadData('teachers', force),
      loadData('subjects', force),
      loadData('timetables', force),
      loadData('identity', force)
    ]);
    
    setClasses(VDB.queryAll('classes'));
    setTeachers(VDB.queryAll('teachers'));
    setSubjects(VDB.queryAll('subjects'));
    setEntries(VDB.queryAll('timetables'));
    
    const identity = VDB.queryAll<any>('identity')[0];
    if (identity?.periodTimings) {
      setPeriodTimings(identity.periodTimings);
    } else {
      const defaultTimings = DEFAULT_PERIODS.map((label, idx) => ({
        index: idx,
        label: label,
        startTime: '08:00',
        endTime: '08:45'
      }));
      setPeriodTimings(defaultTimings);
    }
    
    setDataVersion(v => v + 1);
  }, []);

  useEffect(() => {
    fetchRegistry();
    const handleUpdate = () => {
        setEntries(VDB.queryAll('timetables'));
        const identity = VDB.queryAll<any>('identity')[0];
        if (identity?.periodTimings) setPeriodTimings(identity.periodTimings);
        setDataVersion(v => v + 1);
    };
    window.addEventListener('DATA_UPDATED', handleUpdate);
    return () => window.removeEventListener('DATA_UPDATED', handleUpdate);
  }, [fetchRegistry]);

  const checkTeacherConflict = (teacherId: string, day: string, periodIndex: number, excludeGradeId: string) => {
    if (!teacherId || teacherId === '') return null;
    return entries.find(e => e.teacherId === teacherId && e.day === day && e.periodIndex === periodIndex && e.gradeId !== excludeGradeId);
  };

  const handleManualSave = async () => {
    setSaveStatus('SAVING');
    
    // Save both timetables and updated identity (for timings)
    const currentIdentity = VDB.queryAll<any>('identity')[0] || { id: 'IDENTITY_MAIN' };
    const updatedIdentity = { ...currentIdentity, periodTimings };
    
    const success1 = await saveData('timetables', entries);
    const success2 = await saveData('identity', [updatedIdentity]);
    
    if (success1 && success2) {
      setSaveStatus('SUCCESS');
      setTimeout(() => setSaveStatus('IDLE'), 3000);
    } else {
      setSaveStatus('IDLE');
    }
  };

  const getSlotEntry = (day: string, periodIndex: number) => {
    if (viewMode === 'CLASS') {
      return entries.find(e => e.gradeId === selectedGradeId && e.day === day && e.periodIndex === periodIndex);
    } else {
      return entries.find(e => e.teacherId === selectedTeacherId && e.day === day && e.periodIndex === periodIndex);
    }
  };

  const handleSlotClick = (day: string, periodIndex: number) => {
    if (!isAdmin || viewMode !== 'CLASS' || !selectedGradeId) return;
    if (DEFAULT_PERIODS[periodIndex] === 'Break') return;
    setActiveSlot({ day, periodIndex });
    setIsEditing(true);
  };

  const updateEntry = (subjectId: string, teacherId: string) => {
    if (!activeSlot || !selectedGradeId) return;
    
    const { day, periodIndex } = activeSlot;
    const existingIdx = entries.findIndex(e => e.gradeId === selectedGradeId && e.day === day && e.periodIndex === periodIndex);
    
    const conflict = checkTeacherConflict(teacherId, day, periodIndex, selectedGradeId);
    if (conflict) {
      const conflictClass = classes.find(c => c.id === conflict.gradeId)?.name;
      if (!window.confirm(`CLASH DETECTED: This teacher is already assigned to ${conflictClass} during this period. Proceed with duplicate assignment?`)) {
        return;
      }
    }

    let newEntries = [...entries];
    const newEntry: TimetableEntry = {
      id: `TT_${selectedGradeId}_${day}_${periodIndex}`,
      yearId: activeYear,
      termId: activeTerm,
      gradeId: selectedGradeId,
      day,
      periodIndex,
      subjectId,
      teacherId
    };

    if (subjectId === '') {
        newEntries = newEntries.filter((_, idx) => idx !== existingIdx);
    } else if (existingIdx > -1) {
        newEntries[existingIdx] = newEntry;
    } else {
        newEntries.push(newEntry);
    }

    setEntries(newEntries);
    setIsEditing(false);
    setActiveSlot(null);
  };

  const handleTimingUpdate = (idx: number, field: 'startTime' | 'endTime', value: string) => {
    const updated = [...periodTimings];
    updated[idx] = { ...updated[idx], [field]: value };
    setPeriodTimings(updated);
  };

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 space-y-6 font-sans pb-40">
      {/* BRANDED HEADER SECTION */}
      <div className="bg-white border-2 border-black rounded-[2rem] p-6 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6 print:hidden">
        <div className="flex items-center gap-6 w-full lg:w-auto">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center p-2 border border-slate-100 shrink-0">
             <img src={logo} className="w-full h-full object-contain" alt="SEEDS" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">Timetable Matrix</h1>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Session {activeYear} • Integrated Curriculum Control</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
           <div className="flex bg-slate-100 p-1 rounded-2xl border-2 border-black">
             <button onClick={() => setViewMode('CLASS')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'CLASS' ? 'bg-black text-white shadow-lg' : 'text-black'}`}>Grade View</button>
             <button onClick={() => setViewMode('TEACHER')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'TEACHER' ? 'bg-black text-white shadow-lg' : 'text-black'}`}>Faculty View</button>
           </div>
           
           {isAdmin && (
             <button 
               onClick={() => setIsTimingEdit(true)}
               className="px-6 py-3 bg-white border-2 border-black rounded-2xl font-black text-[10px] uppercase shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
             >
               <i className="fas fa-clock"></i>
               Settings
             </button>
           )}

           {isAdmin && (
             <button 
               onClick={handleManualSave}
               className={`px-8 py-3 border-2 border-black rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all flex items-center gap-2 ${saveStatus === 'SAVING' ? 'bg-amber-50 animate-pulse' : saveStatus === 'SUCCESS' ? 'bg-black text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
             >
               <i className={`fas ${saveStatus === 'SAVING' ? 'fa-sync-alt animate-spin' : saveStatus === 'SUCCESS' ? 'fa-check-circle' : 'fa-shield-halved'}`}></i>
               {saveStatus === 'SAVING' ? 'COMMITTING...' : saveStatus === 'SUCCESS' ? 'RECORD SECURED' : 'SAVE MATRIX'}
             </button>
           )}
           <button onClick={() => navigate('/')} className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all"><i className="fas fa-home"></i></button>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-white p-6 rounded-[2rem] border-2 border-black shadow-sm flex flex-col md:flex-row gap-6 print:hidden">
         {viewMode === 'CLASS' ? (
           <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registry Grade Node</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:border-emerald-600" value={selectedGradeId} onChange={e => setSelectedGradeId(e.target.value)}>
                 <option value="">SCAN ALL CLASSES</option>
                 {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
           </div>
         ) : (
           <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Faculty Identity Node</label>
              <select className="w-full bg-slate-50 border-2 border-black rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:border-emerald-600" value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)}>
                 <option value="">SCAN ALL FACULTY</option>
                 {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
           </div>
         )}
      </div>

      {/* INVERTED TIMETABLE GRID */}
      <div className="bg-white rounded-[3rem] border-4 border-black overflow-hidden shadow-2xl relative">
        <div className="hidden print:flex items-center justify-between p-8 border-b-4 border-black">
            <div className="flex items-center gap-6">
                <img src={logo} className="w-20 h-20 object-contain" alt="Logo" />
                <div>
                   <h2 className="text-3xl font-black uppercase tracking-tight leading-none">{PERMANENT_CONFIG.name}</h2>
                   <p className="text-[12px] font-black uppercase tracking-widest mt-1">OFFICIAL ACADEMIC TIMETABLE MATRIX</p>
                </div>
            </div>
            <div className="text-right">
               <p className="text-[14px] font-black uppercase">
                  {viewMode === 'CLASS' ? `GRADE: ${classes.find(c => c.id === selectedGradeId)?.name || 'N/A'}` : `TEACHER: ${teachers.find(t => t.id === selectedTeacherId)?.name || 'N/A'}`}
               </p>
               <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Session {activeYear} • {activeTerm} Term</p>
            </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse min-w-[1300px]">
            <thead>
              <tr className="bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest">
                <th className="p-6 border-r border-slate-800 w-40 sticky left-0 bg-slate-950 z-20">Week Day</th>
                {DEFAULT_PERIODS.map((period, idx) => {
                  const timing = periodTimings.find(t => t.index === idx);
                  return (
                    <th key={period} className={`p-6 border-r border-slate-800 text-center ${period === 'Break' ? 'bg-slate-900 w-24' : ''}`}>
                      <p>{period}</p>
                      {timing && (
                        <p className="text-[7px] font-bold opacity-60 mt-1 tracking-widest">{timing.startTime} - {timing.endTime}</p>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {DAYS.map(day => (
                <tr key={day} className="hover:bg-slate-50 transition-colors group/row">
                  <td className="p-6 border-r-4 border-black font-black text-center sticky left-0 bg-white z-10">
                     <p className="text-[13px] uppercase text-black leading-none">{day}</p>
                     <div className="w-8 h-1 bg-emerald-500 mx-auto mt-2 rounded-full"></div>
                  </td>
                  {DEFAULT_PERIODS.map((period, pIdx) => {
                    const entry = getSlotEntry(day, pIdx);
                    const isBreak = period === 'Break';
                    const conflict = entry ? checkTeacherConflict(entry.teacherId, day, pIdx, selectedGradeId) : null;

                    return (
                      <td 
                        key={pIdx} 
                        className={`p-4 border-r-2 border-black text-center relative group min-h-[110px] ${!isBreak && isAdmin && viewMode === 'CLASS' ? 'cursor-pointer hover:bg-emerald-50/50' : ''} ${isBreak ? 'bg-slate-100/50' : ''}`}
                        onClick={() => handleSlotClick(day, pIdx)}
                      >
                         {isBreak ? (
                           <div className="flex flex-col items-center justify-center gap-1 opacity-40">
                              <i className="fas fa-coffee text-sm"></i>
                              <span className="text-[9px] font-black uppercase tracking-[0.2em]">RECESS</span>
                           </div>
                         ) : entry ? (
                           <div className={`space-y-1.5 animate-in ${conflict ? 'animate-pulse' : ''}`}>
                              <p className="text-[12px] font-black uppercase text-slate-950 leading-tight">
                                {subjects.find(s => s.id === entry.subjectId)?.name}
                              </p>
                              <div className="flex flex-col items-center">
                                <p className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${conflict ? 'bg-rose-600 text-white' : 'text-emerald-700'}`}>
                                  {viewMode === 'CLASS' ? teachers.find(t => t.id === entry.teacherId)?.name : classes.find(c => c.id === entry.gradeId)?.name}
                                </p>
                                {conflict && (
                                   <p className="text-[7px] font-black text-rose-500 uppercase mt-1">CONFLICT: {classes.find(c => c.id === conflict.gradeId)?.name}</p>
                                )}
                              </div>
                           </div>
                         ) : (
                           <div className="text-[8px] font-black text-slate-200 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                              {isAdmin && viewMode === 'CLASS' ? 'ALLOCATE MODULE' : 'VACANT'}
                           </div>
                         )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PERIOD TIMING CONFIG MODAL */}
      {isTimingEdit && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in">
          <div className="bg-white rounded-[4rem] w-full max-w-3xl shadow-2xl border-t-[16px] border-emerald-600 overflow-hidden">
            <div className="p-10 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-6">
                 <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <i className="fas fa-clock text-xl"></i>
                 </div>
                 <div>
                    <h3 className="text-xl font-black uppercase text-slate-900">Institutional Timing Protocol</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Configure Start & End Cycles for Academic Slots</p>
                 </div>
              </div>
              <button onClick={() => setIsTimingEdit(false)} className="text-slate-300 hover:text-rose-600 transition-colors"><i className="fas fa-times-circle text-4xl"></i></button>
            </div>
            
            <div className="p-10 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
               <div className="grid grid-cols-3 gap-6 bg-slate-950 text-white p-4 rounded-2xl text-[9px] font-black uppercase tracking-widest mb-2">
                  <div className="pl-4">Period Label</div>
                  <div className="text-center">Start Time</div>
                  <div className="text-center">End Time</div>
               </div>
               
               {periodTimings.map((timing, idx) => (
                 <div key={idx} className="grid grid-cols-3 gap-6 items-center p-4 bg-slate-50 border border-slate-100 rounded-3xl group hover:bg-white hover:border-emerald-500 hover:shadow-xl transition-all">
                    <div className="pl-4 font-black text-slate-900 uppercase text-xs tracking-tight">{timing.label}</div>
                    <div className="px-2">
                       <input 
                         type="time" 
                         className="w-full bg-white border-2 border-black rounded-xl px-4 py-2 font-black text-xs outline-none focus:ring-4 focus:ring-emerald-500/10"
                         value={timing.startTime}
                         onChange={(e) => handleTimingUpdate(idx, 'startTime', e.target.value)}
                       />
                    </div>
                    <div className="px-2">
                       <input 
                         type="time" 
                         className="w-full bg-white border-2 border-black rounded-xl px-4 py-2 font-black text-xs outline-none focus:ring-4 focus:ring-emerald-500/10"
                         value={timing.endTime}
                         onChange={(e) => handleTimingUpdate(idx, 'endTime', e.target.value)}
                       />
                    </div>
                 </div>
               ))}
            </div>

            <div className="p-10 bg-slate-50 border-t flex gap-4">
               <button 
                 onClick={() => { handleManualSave(); setIsTimingEdit(false); }}
                 className="flex-1 py-6 bg-slate-950 text-white rounded-[2.5rem] font-black uppercase shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-4"
               >
                 <i className="fas fa-save text-xl"></i>
                 COMMIT TIMING PROTOCOL
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODULE ALLOCATION MODAL */}
      {isEditing && activeSlot && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in">
           <div className="bg-white rounded-[4rem] w-full max-w-2xl shadow-2xl border-t-[16px] border-rose-600 overflow-hidden">
              <div className="p-10 border-b flex justify-between items-center bg-slate-50">
                 <div className="flex items-center gap-6">
                    <img src={logo} className="w-12 h-12 object-contain" alt="SEEDS" />
                    <div>
                        <h3 className="text-xl font-black uppercase text-slate-900">Module Allocation</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{activeSlot.day} • {DEFAULT_PERIODS[activeSlot.periodIndex]} Period</p>
                    </div>
                 </div>
                 <button onClick={() => setIsEditing(false)} className="text-slate-300 hover:text-rose-600 transition-colors"><i className="fas fa-times-circle text-4xl"></i></button>
              </div>
              
              <div className="p-10 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject Module</label>
                        <select className="w-full bg-slate-50 border-2 border-black rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-emerald-500/5" id="selSub">
                           <option value="">- CLEAR SLOT -</option>
                           {subjects.filter(s => s.gradeId === selectedGradeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Faculty Node</label>
                        <select className="w-full bg-slate-50 border-2 border-black rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-4 focus:ring-emerald-500/5" id="selTea">
                           <option value="">- UNASSIGNED -</option>
                           {teachers.map(t => {
                             const conflict = checkTeacherConflict(t.id, activeSlot.day, activeSlot.periodIndex, selectedGradeId);
                             const conflictText = conflict ? `(BUSY: ${classes.find(c => c.id === conflict.gradeId)?.name})` : '(AVAILABLE)';
                             return (
                               <option key={t.id} value={t.id} className={conflict ? 'text-rose-500' : 'text-emerald-600'}>
                                 {t.name} {conflictText}
                               </option>
                             );
                           })}
                        </select>
                    </div>
                 </div>

                 <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                    <p className="text-[11px] font-black text-emerald-900 uppercase italic">
                       <i className="fas fa-info-circle mr-2"></i>
                       Guidance: Select a Subject and Teacher from the registry above. The system will automatically block assignments that conflict with existing faculty schedules.
                    </p>
                 </div>

                 <button 
                   onClick={() => {
                     const s = (document.getElementById('selSub') as HTMLSelectElement).value;
                     const t = (document.getElementById('selTea') as HTMLSelectElement).value;
                     updateEntry(s, t);
                   }}
                   className="w-full py-8 bg-slate-950 text-white rounded-[2.5rem] font-black uppercase shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-4"
                 >
                   <i className="fas fa-shield-check text-xl"></i>
                   CONFIRM SLOT ASSIGNMENT
                 </button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { background: white; }
          .min-h-screen { padding: 0 !important; }
          #root { background: white !important; }
          .bg-white { box-shadow: none !important; border-width: 2px !important; }
          table { width: 100% !important; border: 2px solid black !important; }
          th, td { border: 1px solid black !important; padding: 4px !important; }
          .sticky { position: relative !important; }
          .print-hidden { display: none !important; }
        }
      `    }</style>
    </div>
  );
};

export default Timetable;
