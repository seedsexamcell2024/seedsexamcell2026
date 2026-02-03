
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Student, ClassLevel } from '../types.ts';
import { loadData, getPKTDateString, getPKTDisplayDate, getActiveSessionYear } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

const SearchReports = () => {
  const navigate = useNavigate();
  const activeYear = getActiveSessionYear();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getPKTDateString());
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dataVersion, setDataVersion] = useState(0);
  
  const displayDateLabel = useMemo(() => getPKTDisplayDate(selectedDate), [selectedDate]);
  const logoSrc = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;
  const schoolName = localStorage.getItem('schoolName') || PERMANENT_CONFIG.name;

  const refreshRegistry = useCallback(async (force: boolean = false) => {
    setIsSyncing(true);
    try {
        // Fix: Simplified loadData calls to match Unified Vault Protocol signature (2 arguments max)
        await Promise.all([
            loadData('students', force),
            loadData('classes', force),
            loadData('attendance', true)
        ]);
        
        setStudents(VDB.queryAll('students'));
        setClasses(VDB.queryAll('classes'));
        setDataVersion(v => v + 1);
    } finally {
        setIsSyncing(false);
    }
  }, []);

  const shiftDate = (days: number) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + days);
    const newDateStr = VDB.normalizeDateString(current.toISOString());
    setSelectedDate(newDateStr);
    // Trigger a fresh sync when moving through dates to catch recent register updates
    refreshRegistry(true);
  };

  useEffect(() => {
    refreshRegistry();
    const handleUpdate = () => {
      setStudents(VDB.queryAll('students'));
      setClasses(VDB.queryAll('classes'));
      setDataVersion(v => v + 1);
    };
    window.addEventListener('DATA_UPDATED', handleUpdate);
    return () => window.removeEventListener('DATA_UPDATED', handleUpdate);
  }, [refreshRegistry]);

  const absentList = useMemo(() => {
    // Retrieve all attendance records for the year, across all terms
    const allAttendance = VDB.getFlatAttendance(activeYear);
    
    return allAttendance
    .filter(a => {
        const recordDate = VDB.normalizeDateString(a.date);
        const matchesDate = recordDate === selectedDate;
        const isAbsent = a.status === 'A';
        
        if (!isAbsent || !matchesDate) return false;
        
        // CORE FIX: Use case-insensitive search to link attendance IDs (normalized) with student profiles
        const student = students.find(s => s.id.toLowerCase().trim() === a.studentId.toLowerCase().trim());
        if (!student) return false;
        
        const matchesClass = !selectedClassId || student.gradeId === selectedClassId;
        return matchesClass;
    })
    .map(a => {
        // Safe mapping with case-insensitive lookup
        const student = students.find(s => s.id.toLowerCase().trim() === a.studentId.toLowerCase().trim());
        const classObj = classes.find(c => c.id === student?.gradeId);
        return {
            student,
            className: classObj?.name || 'Unknown',
            date: a.date
        };
    })
    .sort((a, b) => (a.student?.serialNumber || 0) - (b.student?.serialNumber || 0));
  }, [selectedDate, selectedClassId, students, classes, activeYear, dataVersion]);

  return (
    <div className="space-y-8 animate-in pb-20 p-4 lg:p-10 bg-slate-50 min-h-screen font-sans">
        <div className="max-w-7xl mx-auto flex justify-between items-center print:hidden">
            <button onClick={() => navigate('/')} className="px-8 py-3 bg-white border-2 border-black text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-black hover:text-white transition-all">
               <i className="fas fa-chevron-left mr-2"></i> DASHBOARD
            </button>
            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${isSyncing ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100'}`}>
               <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></div>
               <span className={`text-[9px] font-black uppercase tracking-widest ${isSyncing ? 'text-amber-700' : 'text-emerald-700'}`}>
                 {isSyncing ? 'Syncing Matrix...' : 'Registry Nominal'}
               </span>
            </div>
        </div>

        <div className="max-w-7xl mx-auto bg-white p-10 rounded-[3rem] border-4 border-black shadow-2xl space-y-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
                <div className="flex items-center gap-8">
                  <div className="w-24 h-24 bg-white rounded-[2rem] p-4 shadow-xl border-2 border-black flex items-center justify-center shrink-0">
                    <img src={logoSrc} className="w-full h-full object-contain" alt="SEEDS" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter leading-none mb-3 text-black">Absence Alert Console</h2>
                    <div className="flex items-center gap-3">
                       <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">{displayDateLabel}</p>
                       <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Session {activeYear}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap lg:flex-nowrap gap-6 w-full lg:w-auto items-end">
                   <div className="flex-1 lg:w-80 space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Temporal Node</label>
                      <div className="flex items-center gap-2">
                         <button onClick={() => shiftDate(-1)} className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 transition-all active:scale-95 shadow-lg"><i className="fas fa-chevron-left"></i></button>
                         <div className="flex-1 relative group">
                            <input 
                                type="date" 
                                className="w-full bg-slate-50 border-2 border-black rounded-2xl px-4 py-4 text-sm font-black uppercase outline-none focus:border-emerald-600 transition-all text-black tracking-widest cursor-pointer shadow-inner"
                                value={selectedDate}
                                onChange={e => { setSelectedDate(e.target.value); refreshRegistry(true); }}
                            />
                         </div>
                         <button onClick={() => shiftDate(1)} className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 transition-all active:scale-95 shadow-lg"><i className="fas fa-chevron-right"></i></button>
                      </div>
                   </div>
                   <div className="flex-1 lg:w-72 space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Grade Cluster Scan</label>
                      <select 
                        className="w-full bg-slate-50 border-2 border-black rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:border-emerald-600 transition-all text-black tracking-widest shadow-inner"
                        value={selectedClassId}
                        onChange={e => setSelectedClassId(e.target.value)}
                      >
                          <option value="">ALL GRADE NODES</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>
                </div>
            </div>
        </div>

        <div className="max-w-7xl mx-auto overflow-hidden bg-white border-4 border-black rounded-[3rem] shadow-2xl min-h-[400px]">
            <div className="p-8 border-b-4 border-black bg-slate-950 flex justify-between items-center text-white">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.6)]"></div>
                  <h3 className="text-[12px] font-black uppercase tracking-[0.4em]">
                      Absolute Absence Matches ({absentList.length})
                  </h3>
                </div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedDate}</div>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-[0.3em]">
                            <th className="px-10 py-6 border-b-2 border-slate-100">Candidate Identity Profile</th>
                            <th className="px-10 py-6 border-b-2 border-slate-100 text-center">Registry Node</th>
                            <th className="px-10 py-6 border-b-2 border-slate-100 text-right">Dispatch Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-50">
                        {absentList.length > 0 ? absentList.map((record, idx) => {
                            const message = `Dear Parent, this is an official notification from ${schoolName}. Your child ${record.student?.name} (${record.className}) is marked ABSENT today, ${displayDateLabel}. Please inform the school regarding the reason for absence. Thank you.`;
                            const hasPhone = record.student?.parentPhone;
                            return (
                                <tr key={`${record.student?.id}_${idx}`} className="hover:bg-rose-50/30 transition-all group font-black text-black">
                                    <td className="px-10 py-8">
                                      <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-black overflow-hidden shadow-lg shrink-0 flex items-center justify-center">
                                            {record.student?.photo ? (
                                                <img src={record.student.photo} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <i className="fas fa-user text-slate-300 text-xl"></i>
                                            )}
                                        </div>
                                        <div>
                                          <div className="font-black text-slate-900 uppercase text-base tracking-tight mb-1">{record.student?.name}</div>
                                          <div className="text-[9px] font-black text-slate-400 tracking-widest uppercase">REGISTRY ID: {record.student?.rollNumber}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-10 py-8 text-center">
                                        <span className="bg-slate-950 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">{record.className}</span>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        {hasPhone ? (
                                            <button 
                                                onClick={() => window.open(`https://wa.me/${hasPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank')}
                                                className="bg-emerald-600 text-white shadow-xl py-4 px-8 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all active:scale-95 hover:bg-black hover:shadow-emerald-200 flex items-center gap-3 ml-auto"
                                            >
                                                <i className="fab fa-whatsapp text-lg"></i> SEND ALERT
                                            </button>
                                        ) : (
                                            <div className="flex flex-col items-end gap-1 px-4">
                                               <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">UNLINKED CONTACT</span>
                                               <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest italic">Update Profile Node</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={3} className="px-12 py-48 text-center">
                                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-200 border-2 border-dashed border-slate-100">
                                       <i className="fas fa-shield-check text-4xl"></i>
                                    </div>
                                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-3">Verification Nominal</h4>
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] max-w-sm mx-auto leading-relaxed">No candidate absences exist in the Physical Vault for this specific date key.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default SearchReports;
