
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Teacher, ClassLevel, Subject, UserRole } from '../types.ts';
import { loadData, getActiveSessionYear } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

const FacultyRegistry = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const activeYear = getActiveSessionYear();
  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  const fetchData = useCallback(async (force: boolean = false) => {
    setIsLoading(true);
    await Promise.all([
      loadData('teachers', force),
      loadData('classes', force),
      loadData('subjects', force)
    ]);
    setTeachers(VDB.queryAll('teachers'));
    setClasses(VDB.queryAll('classes'));
    setSubjects(VDB.queryAll('subjects'));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getDetailedSubjectNames = (ids: string[]) => {
    return ids.map(id => {
      const sub = subjects.find(s => s.id === id);
      if (!sub) return null;
      const grade = classes.find(c => c.id === sub.gradeId);
      return `${sub.name} (${grade?.name || 'N/A'})`;
    }).filter(Boolean);
  };

  const getGradeNames = (ids: string[]) => {
    return ids.map(id => classes.find(c => c.id === id)?.name).filter(Boolean);
  };

  /**
   * ACADEMIC COORDINATOR SEARCH LOGIC
   * Filters by Teacher Name, Subject Name, or Class Name
   */
  const filteredTeachers = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return teachers;

    return teachers.filter(t => {
      const nameMatch = t.name.toLowerCase().includes(query);
      const stewardshipMatch = getGradeNames(t.classTeacherOf || []).some(g => g?.toLowerCase().includes(query));
      const subjectMatch = getDetailedSubjectNames(t.assignedSubjectIds || []).some(s => s?.toLowerCase().includes(query));
      const roleMatch = t.role.toLowerCase().includes(query);

      return nameMatch || stewardshipMatch || subjectMatch || roleMatch;
    });
  }, [teachers, searchTerm, classes, subjects]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-12 space-y-8 animate-in pb-40">
       {/* INSTITUTIONAL HEADER */}
       <div className="bg-white p-8 rounded-[3rem] border-2 border-black shadow-sm flex flex-col md:flex-row justify-between items-center gap-8 print:hidden">
          <div className="flex items-center gap-6">
             <img src={logo} className="w-20 h-20 object-contain" alt="Logo" />
             <div>
                <h1 className="text-2xl font-black uppercase text-slate-950 tracking-tighter leading-none">Institutional Faculty Ledger</h1>
                <p className="text-[10px] font-black text-black uppercase tracking-[0.4em] mt-2 opacity-50">Authorized Faculty & Module Registry</p>
             </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
             <div className="relative group">
                <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors"></i>
                <input 
                  type="text" 
                  placeholder="SEARCH TEACHER, SUBJECT OR CLASS..." 
                  className="pl-14 pr-6 py-4 bg-slate-50 border-2 border-black rounded-2xl text-[10px] font-black uppercase tracking-widest w-full md:w-80 outline-none focus:border-emerald-600 transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <div className="flex gap-3">
                <button onClick={() => navigate('/')} className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all"><i className="fas fa-home"></i></button>
                <button onClick={() => fetchData(true)} className="px-6 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all">
                  <i className={`fas fa-sync-alt mr-2 ${isLoading ? 'animate-spin' : ''}`}></i> Sync Registry
                </button>
             </div>
          </div>
       </div>

       {/* FACULTY TABLE WRAPPER - LANDSCAPE OPTIMIZED */}
       <div id="faculty-ledger-report" className="bg-white rounded-[3rem] border-2 border-black overflow-hidden shadow-2xl print:border-none print:shadow-none">
          <div className="overflow-x-auto custom-landscape-scrollbar">
             <table className="w-full border-collapse min-w-[1100px]">
                <thead>
                   <tr className="bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest text-center">
                      <th className="p-6 text-left border-r border-slate-800 w-16">Node</th>
                      <th className="p-6 text-left border-r border-slate-800">Faculty Member</th>
                      <th className="p-6 border-r border-slate-800 w-64">Role / Designation</th>
                      <th className="p-6 border-r border-slate-800">Class Stewardship</th>
                      <th className="p-6 border-r border-slate-800">Subject Modules</th>
                   </tr>
                </thead>
                <tbody className="divide-y-2 divide-black">
                   {filteredTeachers.map((t) => {
                      const teacherSubjects = getDetailedSubjectNames(t.assignedSubjectIds || []);
                      const stewardship = getGradeNames(t.classTeacherOf || []);
                      const isClassTeacher = t.role === UserRole.SUBJECT_CLASS_TEACHER;

                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                           <td className="p-6 border-r border-slate-100 text-center font-black text-slate-300">#{t.serialNumber}</td>
                           <td className="p-6 border-r border-slate-100">
                              <p className="text-sm font-black text-slate-950 uppercase tracking-tight">{t.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 mt-1">{t.phone || 'NO CONTACT RECORDED'}</p>
                           </td>
                           <td className="p-6 border-r border-slate-100 text-center">
                              <div className="flex justify-center">
                                <span className={`inline-block px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm whitespace-nowrap border-2 ${isClassTeacher ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white text-slate-900 border-slate-900'}`}>
                                   {t.role || 'Faculty Member'}
                                </span>
                              </div>
                           </td>
                           <td className="p-6 border-r border-slate-100 text-center">
                              {stewardship.length > 0 ? (
                                <div className="flex flex-wrap justify-center gap-1.5">
                                    {stewardship.map(grade => (
                                      <span key={grade} className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 border-emerald-600 shadow-sm">
                                         {grade}
                                      </span>
                                    ))}
                                </div>
                              ) : <span className="text-[9px] font-bold text-slate-200 uppercase tracking-widest">NOT ASSIGNED</span>}
                           </td>
                           <td className="p-6 border-r border-slate-100">
                              <div className="flex flex-wrap gap-1.5">
                                 {teacherSubjects.length > 0 ? teacherSubjects.map(sub => (
                                   <span key={sub} className="bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-[9px] font-black uppercase text-slate-600 print:text-black">
                                      {sub}
                                   </span>
                                 )) : <span className="text-[9px] font-bold text-slate-300 italic">No Modules</span>}
                              </div>
                           </td>
                        </tr>
                      );
                   })}
                   {filteredTeachers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-24 text-center">
                           <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                              <i className="fas fa-search text-2xl"></i>
                           </div>
                           <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">No matching faculty nodes found</p>
                        </td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
       </div>

       <style>{`
        .custom-landscape-scrollbar::-webkit-scrollbar { height: 12px; }
        .custom-landscape-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-landscape-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 10px; border: 3px solid #f1f5f9; }
       `}</style>
    </div>
  );
};

export default FacultyRegistry;
