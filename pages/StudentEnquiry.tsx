
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Student, ClassLevel } from '../types.ts';
import { PERMANENT_CONFIG } from '../config.ts';
import { loadData, getActiveSessionYear } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';

const StudentEnquiry = () => {
  const navigate = useNavigate();
  
  // -- Registry State --
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // -- Search State --
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  
  const activeYear = getActiveSessionYear();

  const fetchAll = useCallback(async (force: boolean = false) => {
    setIsProcessing(true);
    await Promise.all([
        loadData('students', force),
        loadData('classes', force)
    ]);
    setStudents(VDB.queryAll('students'));
    setClasses(VDB.queryAll('classes'));
    setIsProcessing(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return students.filter(s => {
      const matchesText = !searchTerm || 
                         s.name.toLowerCase().includes(term) || 
                         s.rollNumber.toLowerCase().includes(term);
      const matchesClass = !selectedClassId || s.gradeId === selectedClassId;
      return matchesText && matchesClass;
    }).sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0));
  }, [students, searchTerm, selectedClassId]);

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  return (
    <div className="space-y-6 animate-in p-4 lg:p-10 pb-40 bg-slate-50 min-h-screen font-sans selection:bg-emerald-100">
       {/* HUB HEADER */}
       <div className="bg-white border-2 border-black rounded-[2rem] p-6 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
             <img src={logo} className="w-14 h-14 object-contain" alt="SEEDS" />
             <div>
                <h1 className="text-xl font-black uppercase tracking-tighter leading-none">Identity Registry Hub</h1>
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">SEEDS Institutional Directory</p>
             </div>
          </div>
          
          <div className="flex gap-3">
             <button 
               onClick={() => fetchAll(true)} 
               disabled={isProcessing}
               className="px-6 py-2.5 bg-slate-100 border-2 border-black rounded-xl text-[9px] font-black uppercase hover:bg-black hover:text-white transition-all shadow-sm"
             >
                <i className={`fas fa-sync-alt mr-2 ${isProcessing ? 'animate-spin' : ''}`}></i>
                Refresh Registry
             </button>
             <button 
               onClick={() => navigate('/')} 
               className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all"
             >
                <i className="fas fa-home"></i>
             </button>
          </div>
       </div>

       {/* SEARCH CONSOLE */}
       <div className="bg-white p-6 rounded-[2.5rem] border-2 border-black shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5 md:col-span-1">
             <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade Cluster</label>
             <select 
               className="w-full bg-slate-50 border-2 border-black rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-emerald-600 transition-all" 
               value={selectedClassId} 
               onChange={e => setSelectedClassId(e.target.value)}
             >
                <option value="">ALL CLUSTERS</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
             <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Profile</label>
             <div className="relative">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input 
                  type="text" 
                  placeholder="SCAN NAME OR REGISTRY ID..." 
                  className="w-full bg-slate-50 border-2 border-black rounded-xl pl-12 pr-4 py-3 text-[10px] font-black uppercase outline-none focus:border-emerald-600 transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
       </div>

       {/* CANDIDATE GRID */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStudents.length > 0 ? filteredStudents.map(student => (
            <div key={student.id} className="bg-white border-2 border-black rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col">
               <div className="flex gap-5 mb-4">
                  <div className="w-16 h-20 bg-slate-50 rounded-2xl overflow-hidden border-2 border-black shadow-inner flex items-center justify-center shrink-0">
                     {student.photo ? (
                        <img src={student.photo} className="w-full h-full object-cover" alt="" />
                     ) : (
                        <i className="fas fa-user-graduate text-xl text-slate-200"></i>
                     )}
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">#{student.serialNumber}</p>
                     <h3 className="text-xs font-black uppercase text-slate-950 truncate leading-tight mt-1">{student.name}</h3>
                     <p className="text-[9px] font-mono text-slate-400 font-bold mt-1 tracking-tighter">ID: {student.rollNumber}</p>
                  </div>
               </div>
               
               <div className="mt-auto pt-4 border-t border-slate-50 space-y-2">
                  <div className="flex justify-between items-center">
                     <span className="text-[8px] font-black text-slate-300 uppercase">Grade Level</span>
                     <span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded-lg text-[7px] font-black uppercase">
                        {classes.find(c => c.id === student.gradeId)?.name || 'Unlinked'}
                     </span>
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-[8px] font-black text-slate-300 uppercase">Guardian</span>
                     <span className="text-[8px] font-black text-slate-600 uppercase truncate max-w-[100px]">{student.parentName || 'N/A'}</span>
                  </div>
                  {student.parentPhone && (
                     <div className="pt-2">
                        <button 
                          onClick={() => window.open(`tel:${student.parentPhone}`, '_self')}
                          className="w-full py-2 bg-slate-50 border border-slate-100 rounded-xl text-[7px] font-black uppercase text-slate-400 hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                           <i className="fas fa-phone-alt"></i> Contact Node
                        </button>
                     </div>
                  )}
               </div>
            </div>
          )) : (
            <div className="col-span-full py-40 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
               <i className="fas fa-user-slash text-4xl text-slate-100 mb-4"></i>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">No Registry Matches Found</p>
            </div>
          )}
       </div>

       <style>{`
         .custom-scrollbar::-webkit-scrollbar { width: 6px; }
         .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
         .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
       `}</style>
    </div>
  );
};

export default StudentEnquiry;
