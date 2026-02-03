
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Teacher, ClassLevel, Student } from '../types.ts';
import { loadData, saveData, getActiveSessionYear } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

const ClassTeacherPanel = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [activeTeacherId, setActiveTeacherId] = useState(localStorage.getItem('class_teacher_identity') || '');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [dataVersion, setDataVersion] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const activeYear = getActiveSessionYear();
  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  const monthsList = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  const fetchRegistry = useCallback(async (force: boolean = false) => {
    setIsSyncing(true);
    // Fix: Simplified loadData calls to match Unified Vault Protocol signature (2 arguments max)
    await Promise.all([
      loadData('teachers', force),
      loadData('classes', force),
      loadData('students', force),
      loadData('attendance', force)
    ]);
    setTeachers(VDB.queryAll('teachers'));
    setClasses(VDB.queryAll('classes'));
    setDataVersion(v => v + 1);
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  const activeTeacher = useMemo(() => teachers.find(t => t.id === activeTeacherId), [teachers, activeTeacherId]);
  
  const assignedClasses = useMemo(() => {
    if (!activeTeacher) return [];
    return classes.filter(c => activeTeacher.classTeacherOf?.includes(c.id));
  }, [activeTeacher, classes]);

  useEffect(() => {
    if (assignedClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(assignedClasses[0].id);
    }
  }, [assignedClasses, selectedClassId]);

  const students = useMemo(() => VDB.getStudentsByClass(selectedClassId), [selectedClassId, dataVersion]);

  const daysInMonth = useMemo(() => {
    const monthIndex = monthsList.indexOf(selectedMonth) + 1;
    const year = parseInt(activeYear);
    return new Date(year, monthIndex, 0).getDate();
  }, [selectedMonth, activeYear]);

  const checkIsWeekend = (y: number, m: number, d: number) => {
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  const handleStatusChange = async (studentId: string, day: number, currentStatus: string) => {
    const monthIndex = monthsList.indexOf(selectedMonth) + 1;
    if (checkIsWeekend(parseInt(activeYear), monthIndex, day)) return;

    const statuses = ['P', 'A', 'H', '-'];
    const nextIdx = (statuses.indexOf(currentStatus) + 1) % statuses.length;
    const newStatus = statuses[nextIdx];

    const dStr = `${activeYear}-${String(monthIndex).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const targetTerm = (monthIndex >= 9 && monthIndex <= 11) ? '1st' : '2nd';

    VDB.populateTable('attendance', [{ studentId, date: dStr, status: newStatus, termId: targetTerm, yearId: activeYear }]);
    setDataVersion(v => v + 1);
    
    // Fix: Simplified saveData call to match Unified Vault Protocol signature (2 arguments max)
    await saveData('attendance', VDB.getFlatAttendance());
  };

  const handleIdentityChange = (id: string) => {
    setActiveTeacherId(id);
    localStorage.setItem('class_teacher_identity', id);
  };

  if (!activeTeacherId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
         <div className="w-full max-w-lg bg-white rounded-[3rem] p-12 shadow-2xl space-y-8 border-t-[16px] border-emerald-600">
            <div className="text-center">
               <img src={logo} className="w-20 h-20 mx-auto object-contain mb-6" alt="SEEDS" />
               <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">Faculty Authentication</h2>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Identify your Faculty Node to Access Hub</p>
            </div>
            <div className="space-y-4">
               <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black uppercase text-sm outline-none focus:border-emerald-600" onChange={e => handleIdentityChange(e.target.value)}>
                  <option value="">CHOOSE YOUR IDENTITY</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
            </div>
            <button onClick={() => navigate('/')} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cancel Access</button>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-12 space-y-8 animate-in pb-40">
       <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 p-2">
                <img src={logo} className="w-full h-full object-contain" alt="Logo" />
             </div>
             <div>
                <h1 className="text-xl font-black uppercase text-slate-950 leading-none">Class Teacher Panel</h1>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Teacher: {activeTeacher?.name}</p>
             </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
             <button onClick={() => fetchRegistry(true)} className="px-6 py-3 bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl">
               <i className="fas fa-microchip mr-2"></i> FORENSIC REBUILD
             </button>
             <button onClick={() => { setActiveTeacherId(''); localStorage.removeItem('class_teacher_identity'); }} className="px-6 py-3 bg-slate-50 text-slate-400 border border-slate-200 rounded-2xl text-[10px] font-black uppercase">Identity Switch</button>
             <button onClick={() => navigate('/')} className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg"><i className="fas fa-home"></i></button>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-2">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Class</label>
             <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-3 font-black uppercase text-[11px] outline-none" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                {assignedClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {assignedClasses.length === 0 && <option value="">No Class Assigned</option>}
             </select>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-2">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Volume (Month)</label>
             <select className="w-full bg-slate-50 border-2 border-black rounded-2xl px-6 py-3 font-black uppercase text-[11px] outline-none" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
             </select>
          </div>
          <div className="flex items-end">
             <div className={`w-full py-4 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest ${isSyncing ? 'bg-amber-50 animate-pulse text-amber-700' : 'bg-emerald-50 text-emerald-700'} border border-transparent shadow-sm`}>
                {isSyncing ? 'ACCESSING INSTITUTIONAL VAULT...' : 'LEDGER SYNCHRONIZED'}
             </div>
          </div>
       </div>

       <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
             <table className="w-full border-collapse">
                <thead>
                   <tr className="bg-slate-950 text-white text-[9px] font-black uppercase tracking-widest sticky top-0 z-30">
                      <th className="p-5 text-left border-r border-slate-800 sticky left-0 bg-slate-950 z-40 w-52 shadow-xl">Candidate Node</th>
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                         const day = i + 1;
                         const isWeekend = checkIsWeekend(parseInt(activeYear), monthsList.indexOf(selectedMonth) + 1, day);
                         return <th key={day} className={`p-2 border-r border-slate-800 min-w-[34px] text-center ${isWeekend ? 'bg-green-600 text-green-50' : ''}`}>{day}</th>
                      })}
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {students.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                         <td className="p-5 sticky left-0 bg-white z-20 border-r border-slate-100 shadow-xl w-52">
                            <p className="text-[10px] font-black uppercase text-slate-950 whitespace-nowrap overflow-hidden text-ellipsis">{s.name}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">{s.rollNumber}</p>
                         </td>
                         {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const monthIdx = monthsList.indexOf(selectedMonth) + 1;
                            // Fix: getAttendanceStatus now expects formatted date string
                            const status = VDB.getAttendanceStatus(s.id, `${activeYear}-${String(monthIdx).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
                            const isWeekend = checkIsWeekend(parseInt(activeYear), monthIdx, day);

                            return (
                               <td key={day} className={`p-1 border-r border-slate-100 text-center ${isWeekend ? 'bg-green-50 pointer-events-none' : (status === 'H' ? 'bg-amber-100' : 'cursor-pointer hover:bg-emerald-50')}`} onClick={() => handleStatusChange(s.id, day, status)}>
                                  <div className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${status !== '-' ? 'bg-black text-white shadow-lg scale-110' : 'text-slate-200'}`}>
                                     {status === '-' ? '' : status}
                                  </div>
                               </td>
                            );
                         })}
                      </tr>
                   ))}
                   {students.length === 0 && (
                      <tr>
                         <td colSpan={daysInMonth + 1} className="py-40 text-center opacity-20">
                            <i className="fas fa-folder-open text-6xl block mb-6"></i>
                            <p className="text-[12px] font-black uppercase tracking-[0.5em]">No Candidates found for this Teacher Node</p>
                         </td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
       </div>

       <div className="flex flex-wrap justify-center gap-6 lg:gap-10 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm max-w-4xl mx-auto">
          {[
            { label: 'PRESENT', code: 'P', color: 'bg-black text-white' },
            { label: 'ABSENT', code: 'A', color: 'bg-black text-white' },
            { label: 'HOLIDAY', code: 'H', color: 'bg-amber-200 text-amber-900 border-amber-300' },
            { label: 'WEEKEND', code: 'WE', color: 'bg-green-100 text-green-800 border-green-200' },
            { label: 'UNMARKED', code: '-', color: 'bg-slate-100 text-slate-400' }
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
               <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center text-[8px] font-black border`}>{item.code}</div>
               <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{item.label}</span>
            </div>
          ))}
       </div>
    </div>
  );
};

export default ClassTeacherPanel;
