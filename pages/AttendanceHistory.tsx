
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Student, ClassLevel, AttendanceRecord } from '../types.ts';
import { loadData, getActiveSessionYear } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

const AttendanceHistory = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  
  const activeYear = getActiveSessionYear();
  
  const [filter, setFilter] = useState({
    date: new Date().toISOString().split('T')[0],
    gradeId: localStorage.getItem('attendance_last_grade') || '',
  });

  // Use VDB.isWeekend for absolute temporal locking consistency (fixes potential timezone drift)
  const isWeekend = useMemo(() => {
    return VDB.isWeekend(filter.date);
  }, [filter.date]);

  /**
   * Date Navigation Protocol: Skip Saturday (6) and Sunday (0) using VDB logic
   */
  const shiftDate = (days: number) => {
    let current = new Date(filter.date + 'T12:00:00');
    let count = 0;
    const direction = days > 0 ? 1 : -1;
    const steps = Math.abs(days);

    while (count < steps) {
      current.setDate(current.getDate() + direction);
      const dStr = VDB.normalizeDateString(current);
      if (!VDB.isWeekend(dStr)) {
        count++;
      }
    }
    setFilter({ ...filter, date: VDB.normalizeDateString(current) });
  };

  const fetchHistoricalData = useCallback(async (force: boolean = false) => {
    setIsLoading(true);
    try {
      // Fix: Simplified loadData calls to match Unified Vault Protocol signature (2 arguments max)
      await Promise.all([
        loadData('classes', force),
        loadData('students', force),
        loadData('attendance', true)
      ]);
      
      setClasses(VDB.queryAll('classes'));
      setStudents(VDB.queryAll('students'));
      
      if (filter.gradeId) {
        // Method now implemented in VirtualDatabase
        const dates = VDB.getDatesWithDataForGrade(filter.gradeId, activeYear);
        setAvailableDates(dates);
      }
    } catch (e) {
      console.error("Critical Registry Load Failure", e);
    } finally {
      setIsLoading(false);
    }
  }, [activeYear, filter.gradeId]);

  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  const activeRoster = useMemo(() => {
    if (!filter.gradeId || isWeekend) return [];
    return students.filter(s => s.gradeId === filter.gradeId)
                   .sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0));
  }, [students, filter.gradeId, isWeekend]);

  const stats = useMemo(() => {
    if (!filter.date || activeRoster.length === 0 || isWeekend) return { present: 0, absent: 0, holiday: 0, unmarked: 0 };
    
    // Removed call to non-existent VDB.getLiteralComponents
    let p = 0, a = 0, h = 0, u = 0;
    activeRoster.forEach(s => {
      // Fix: Use direct date string as getAttendanceStatus handles normalization
      const status = VDB.getAttendanceStatus(s.id, filter.date);
      if (status === 'P') p++;
      else if (status === 'A') a++;
      else if (status === 'H') h++;
      else u++;
    });
    return { present: p, absent: a, holiday: h, unmarked: u };
  }, [filter.date, activeRoster, isWeekend]);

  const getStatus = (studentId: string) => {
    // Removed call to non-existent VDB.getLiteralComponents
    // Fix: Use direct date string as getAttendanceStatus handles normalization
    return VDB.getAttendanceStatus(studentId, filter.date);
  };

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-40">
      <div className="bg-white border-b-4 border-black p-6 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
             <img src={logo} className="w-14 h-14 object-contain" alt="Logo" />
             <div>
                <h1 className="text-2xl font-black uppercase tracking-tighter text-black leading-none">Attendance Ledger</h1>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2">Historical Audit • Registry Archive</p>
             </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => fetchHistoricalData(true)} className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95">
                <i className={`fas fa-sync-alt mr-2 ${isLoading ? 'animate-spin' : ''}`}></i> Refetch From Vault
             </button>
             <button onClick={() => navigate('/')} className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all"><i className="fas fa-home"></i></button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-10">
        <div className="bg-white border-4 border-black p-8 rounded-[3rem] shadow-xl space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade Cluster</label>
                 <select 
                   className="w-full bg-slate-50 border-2 border-black rounded-3xl px-6 py-5 text-lg font-black uppercase outline-none focus:ring-8 focus:ring-emerald-500/5 transition-all" 
                   value={filter.gradeId} 
                   onChange={e => {setFilter({...filter, gradeId: e.target.value}); localStorage.setItem('attendance_last_grade', e.target.value);}}
                 >
                    <option value="">SELECT CLASS</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Date Node (Weekday Only)</label>
                 <div className="flex items-center gap-3">
                   <button 
                     onClick={() => shiftDate(-1)}
                     className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 active:scale-90 transition-all shadow-lg"
                   >
                     <i className="fas fa-chevron-left text-sm"></i>
                   </button>
                   
                   <input 
                     type="date" 
                     className={`flex-1 bg-slate-50 border-2 border-black rounded-3xl px-6 py-5 text-lg font-black outline-none focus:ring-8 focus:ring-emerald-500/5 transition-all cursor-pointer ${isWeekend ? 'text-rose-600' : ''}`}
                     value={filter.date} 
                     onChange={e => setFilter({...filter, date: e.target.value})} 
                   />

                   <button 
                     onClick={() => shiftDate(1)}
                     className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 active:scale-90 transition-all shadow-lg"
                   >
                     <i className="fas fa-chevron-right text-sm"></i>
                   </button>
                 </div>
              </div>
           </div>
        </div>

        {activeRoster.length > 0 && !isWeekend && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 animate-in">
             <div className="bg-white border-2 border-black p-6 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Present</p>
                <p className="text-4xl font-black text-emerald-600">{stats.present}</p>
             </div>
             <div className="bg-white border-2 border-black p-6 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Absent</p>
                <p className="text-4xl font-black text-rose-600">{stats.absent}</p>
             </div>
             <div className="bg-white border-2 border-black p-6 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Holiday</p>
                <p className="text-4xl font-black text-amber-500">{stats.holiday}</p>
             </div>
             <div className="bg-slate-950 border-2 border-black p-6 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Total</p>
                <p className="text-4xl font-black text-white">{activeRoster.length}</p>
             </div>
          </div>
        )}

        <div className={`bg-white border-4 border-black rounded-[4rem] overflow-hidden shadow-2xl relative min-h-[500px] transition-all`}>
           {isLoading && (
             <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-50 flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-950">Deep Matrix Scan...</p>
             </div>
           )}

           {isWeekend ? (
             <div className="flex flex-col items-center justify-center py-40 text-center px-10">
                <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-8 border border-rose-100 text-rose-600 text-4xl">
                   <i className="fas fa-lock"></i>
                </div>
                <h3 className="text-xl font-black uppercase tracking-widest mb-2">Registry Weekend Lock</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] max-w-sm">Institutional rules prohibit weekend attendance entries. No data exists for this node.</p>
                <button onClick={() => shiftDate(1)} className="mt-8 px-10 py-4 bg-black text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-all shadow-xl">Audit Next Weekday</button>
             </div>
           ) : (
             <>
               <div className="bg-slate-950 p-8 flex justify-between items-center text-white border-b-2 border-black">
                  <div className="flex items-center gap-4">
                     <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
                     <span className="text-[12px] font-black uppercase tracking-[0.3em]">Registry Date: {filter.date}</span>
                  </div>
                  <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest bg-emerald-950/50 px-4 py-1 rounded-full border border-emerald-900/50">Session {activeYear} Verified</span>
               </div>

               <div className="divide-y-4 divide-slate-50">
                  {activeRoster.map((student, idx) => {
                    const status = getStatus(student.id);
                    const statusMap: any = {
                      'P': { bg: 'bg-emerald-600', text: 'PRESENT', icon: 'fa-check' },
                      'A': { bg: 'bg-rose-600', text: 'ABSENT', icon: 'fa-times' },
                      'H': { bg: 'bg-amber-500', text: 'HOLIDAY', icon: 'fa-umbrella-beach' },
                      '-': { bg: 'bg-slate-100', text: 'NO RECORD', icon: 'fa-minus' }
                    };
                    const config = statusMap[status] || statusMap['-'];

                    return (
                      <div key={student.id} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-all group">
                         <div className="flex items-center gap-8">
                            <span className="text-[11px] font-black text-slate-200 w-10">#{idx+1}</span>
                            <div>
                               <h3 className="text-xl font-black uppercase text-slate-900 leading-none group-hover:text-emerald-700 transition-colors">{student.name}</h3>
                               <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">ID: {student.rollNumber}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-6">
                            <div className={`px-8 py-3 rounded-2xl ${config.bg} text-white shadow-lg flex items-center gap-3 transition-all group-hover:scale-105`}>
                               <i className={`fas ${config.icon} text-sm`}></i>
                               <span className="text-[11px] font-black uppercase tracking-widest">{config.text}</span>
                            </div>
                         </div>
                      </div>
                    );
                  })}

                  {activeRoster.length === 0 && !isLoading && !isWeekend && (
                    <div className="py-60 text-center">
                       <div className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] flex items-center justify-center mx-auto mb-8 grayscale opacity-50">
                          <i className="fas fa-database text-4xl text-slate-300"></i>
                       </div>
                       <h4 className="text-lg font-black text-slate-900 uppercase tracking-widest">Registry Ready</h4>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mt-4">Select a Grade Node to initialize scan</p>
                    </div>
                  )}
               </div>
             </>
           )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceHistory;
