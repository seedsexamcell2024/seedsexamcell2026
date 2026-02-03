
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Teacher, UserRole, ClassLevel, Subject } from '../types.ts';
import { saveData, loadData, performCascadingDelete } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';

const Teachers = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Teacher>>({
    name: '', phone: '', role: UserRole.SUBJECT_TEACHER,
    assignedGradeIds: [], assignedSubjectIds: [], classTeacherOf: []
  });

  const fetchFullRegistry = useCallback(async (force: boolean = false) => {
    setIsLoading(true);
    await Promise.allSettled([
        loadData('teachers', force),
        loadData('classes', force),
        loadData('subjects', force)
    ]);
    setTeachers([...VDB.queryAll<Teacher>('teachers')].sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0)));
    setClasses(VDB.queryAll<ClassLevel>('classes'));
    setSubjects(VDB.queryAll('subjects'));
    setDataVersion(v => v + 1);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchFullRegistry();
    const handleUpdate = () => {
        setTeachers([...VDB.queryAll<Teacher>('teachers')].sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0)));
        setClasses(VDB.queryAll<ClassLevel>('classes'));
        setSubjects(VDB.queryAll('subjects'));
        setDataVersion(v => v + 1);
    };
    window.addEventListener('DATA_UPDATED', handleUpdate);
    return () => window.removeEventListener('DATA_UPDATED', handleUpdate);
  }, [fetchFullRegistry]);

  const commitToVault = async (newList: Teacher[]) => {
    const stabilized = [...newList]
      .filter(t => t && t.id)
      .sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0))
      .map((t, idx) => ({ ...t, serialNumber: idx + 1 }));
    await saveData('teachers', stabilized);
    setTeachers(stabilized);
    setDataVersion(v => v + 1);
  };

  const handleDeleteFaculty = async (id: string, name: string) => {
    if (window.confirm(`FACULTY REMOVAL: Discharge teacher "${name}"? This will unbind them from all classes and subjects.`)) {
      setIsLoading(true);
      const success = await performCascadingDelete('TEACHER', id);
      if (success) {
        setTeachers(prev => prev.filter(t => t.id !== id));
      }
      setIsLoading(false);
    }
  };

  const handleCheckboxToggle = (type: 'classes' | 'subjects' | 'isClassTeacher', id: string) => {
    setFormData(prev => {
        let field: keyof Teacher;
        if (type === 'classes') field = 'assignedGradeIds';
        else if (type === 'subjects') field = 'assignedSubjectIds';
        else field = 'classTeacherOf';
        const current = Array.isArray(prev[field]) ? (prev[field] as string[]) : [];
        const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        
        return { ...prev, [field]: updated };
    });
  };

  const handleRoleSelection = (roleType: 'subject' | 'class', checked: boolean) => {
    setFormData(prev => {
        const isSubject = roleType === 'subject' ? checked : (prev.role === UserRole.SUBJECT_TEACHER || prev.role === UserRole.SUBJECT_CLASS_TEACHER);
        const isClass = roleType === 'class' ? checked : (prev.role === UserRole.SUBJECT_CLASS_TEACHER);

        let newRole = UserRole.SUBJECT_TEACHER;
        if (isSubject && isClass) newRole = UserRole.SUBJECT_CLASS_TEACHER;
        else if (isClass) newRole = UserRole.SUBJECT_CLASS_TEACHER;
        else if (isSubject) newRole = UserRole.SUBJECT_TEACHER;

        return { 
          ...prev, 
          role: newRole,
          classTeacherOf: (roleType === 'class' && !checked) ? [] : (prev.classTeacherOf || [])
        };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let updated: Teacher[];
    if (editingId) {
      updated = teachers.map(t => t.id === editingId ? { ...t, ...formData } as Teacher : t);
    } else {
      updated = [...teachers, { 
        id: `TEA_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`, 
        serialNumber: teachers.length + 1, 
        ...formData 
      } as Teacher];
    }
    await commitToVault(updated);
    setIsModalOpen(false); setEditingId(null);
  };

  const getDetailedSubjectNames = (ids: string[]) => {
    return ids.map(id => {
      const sub = subjects.find(s => s.id === id);
      if (!sub) return null;
      const grade = classes.find(c => c.id === sub.gradeId);
      return `${sub.name} (${grade?.name || 'N/A'})`;
    }).filter(Boolean).join(', ');
  };

  const getGradeNames = (ids: string[]) => {
    return ids.map(id => classes.find(c => c.id === id)?.name).filter(Boolean).join(', ');
  };

  return (
    <div className="space-y-10 animate-in pb-40 p-6 lg:p-16">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm print:hidden">
        <button onClick={() => navigate('/')} className="px-10 py-3 bg-slate-50 border border-slate-200 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all"><i className="fas fa-chevron-left mr-2"></i> DASHBOARD</button>
        <div className="flex flex-wrap gap-3">
           <button onClick={() => fetchFullRegistry(true)} className="px-8 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"><i className="fas fa-sync-alt mr-2"></i> SYNC VAULT</button>
           <button onClick={() => { setEditingId(null); setFormData({name: '', phone: '', role: UserRole.SUBJECT_TEACHER, assignedGradeIds: [], assignedSubjectIds: [], classTeacherOf: []}); setIsModalOpen(true); }} className="px-10 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 shadow-xl">APPEND FACULTY</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {teachers.map(teacher => (
          <div key={teacher.id} className="bg-white border-4 border-black p-8 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all flex flex-col h-full relative group">
            <div className="absolute top-6 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all print:hidden">
              <button onClick={() => { setEditingId(teacher.id); setFormData(teacher); setIsModalOpen(true); }} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-emerald-600 border border-slate-100 flex items-center justify-center shadow-sm"><i className="fas fa-edit text-xs"></i></button>
              <button onClick={() => handleDeleteFaculty(teacher.id, teacher.name)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-400 hover:text-rose-600 border border-rose-100 flex items-center justify-center shadow-sm"><i className="fas fa-trash-alt text-xs"></i></button>
            </div>
            
            <div className="mb-6">
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">FACULTY NODE #{teacher.serialNumber}</p>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight mb-2">{teacher.name}</h4>
              <span className={`inline-block px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${teacher.role === UserRole.SUBJECT_CLASS_TEACHER ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white'}`}>
                {teacher.role === UserRole.SUBJECT_CLASS_TEACHER ? 'Subject & Class Teacher' : 'Subject Teacher'}
              </span>
            </div>

            <div className="space-y-4 flex-1">
               {/* PERMANENT CLASS TEACHER BADGE */}
               <div className={`p-4 rounded-2xl border-2 transition-all ${teacher.classTeacherOf && teacher.classTeacherOf.length > 0 ? 'bg-emerald-50 border-emerald-600' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                  <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${teacher.classTeacherOf && teacher.classTeacherOf.length > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                    <i className="fas fa-crown mr-2"></i>
                    CLASS TEACHER NODE
                  </p>
                  <p className={`text-xs font-black uppercase ${teacher.classTeacherOf && teacher.classTeacherOf.length > 0 ? 'text-emerald-900' : 'text-slate-400'}`}>
                    {getGradeNames(teacher.classTeacherOf || []) || 'No Designated Class'}
                  </p>
               </div>

               <div className="space-y-1 mt-4">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Assigned Modules (Subject & Grade)</p>
                  <p className="text-[10px] font-black text-slate-800 uppercase leading-relaxed">
                    {getDetailedSubjectNames(teacher.assignedSubjectIds || []) || 'No Modules Linked'}
                  </p>
               </div>
               <div className="space-y-1">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Authorized Grade Access</p>
                  <p className="text-[10px] font-black text-slate-800 uppercase">
                    {getGradeNames(teacher.assignedGradeIds || []) || 'None Assigned'}
                  </p>
               </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 flex items-center gap-3">
               <i className="fas fa-phone text-[10px] text-slate-300"></i>
               <span className="text-[10px] font-bold text-slate-400">{teacher.phone || 'NO CONTACT'}</span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in">
           <div className="bg-white rounded-[4rem] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border-t-[20px] border-emerald-600">
              <div className="p-12 border-b flex justify-between items-center">
                 <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Faculty Member Config</h3>
                 <button onClick={() => setIsModalOpen(false)} className="w-16 h-16 bg-slate-100 rounded-[2rem] text-slate-400 hover:text-rose-600 transition-all"><i className="fas fa-times text-2xl"></i></button>
              </div>
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-12 space-y-12">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="space-y-10">
                       <div className="space-y-6">
                          <p className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Personnel Details</p>
                          <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-black rounded-3xl px-8 py-5 text-sm font-black uppercase" placeholder="Full Name" required />
                          <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 border-2 border-black rounded-3xl px-8 py-5 text-sm font-black" placeholder="Contact Phone" />
                       </div>

                       <div className="space-y-6 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                          <p className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Designated Roles</p>
                          <div className="flex flex-col gap-4">
                             <label className="flex items-center gap-4 cursor-pointer p-4 hover:bg-white rounded-3xl transition-all border border-transparent hover:border-slate-200">
                                <input 
                                  type="checkbox" 
                                  checked={formData.role === UserRole.SUBJECT_TEACHER || formData.role === UserRole.SUBJECT_CLASS_TEACHER} 
                                  onChange={(e) => handleRoleSelection('subject', e.target.checked)}
                                  className="w-6 h-6 accent-black" 
                                />
                                <span className="text-[11px] font-black uppercase tracking-tight">Subject Teacher</span>
                             </label>
                             <label className="flex items-center gap-4 cursor-pointer p-4 hover:bg-white rounded-3xl transition-all border border-transparent hover:border-slate-200">
                                <input 
                                  type="checkbox" 
                                  checked={formData.role === UserRole.SUBJECT_CLASS_TEACHER} 
                                  onChange={(e) => handleRoleSelection('class', e.target.checked)}
                                  className="w-6 h-6 accent-emerald-600" 
                                />
                                <span className="text-[11px] font-black uppercase tracking-tight text-emerald-700">Class Teacher</span>
                             </label>
                          </div>
                       </div>
                    </div>
                    
                    <div className="space-y-6 col-span-2 grid grid-cols-1 md:grid-cols-3 gap-8">
                       <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 h-[500px] overflow-y-auto space-y-2">
                          <p className="text-[10px] font-black text-black uppercase tracking-widest px-2 mb-2">GRADE CLUSTERS (ACCESS)</p>
                          {classes.map(c => (
                            <label key={c.id} className="flex items-center gap-4 p-4 hover:bg-white rounded-3xl cursor-pointer transition-all">
                               <input type="checkbox" checked={formData.assignedGradeIds?.includes(c.id)} onChange={() => handleCheckboxToggle('classes', c.id)} className="w-6 h-6 accent-black" />
                               <span className="text-xs font-black uppercase">{c.name}</span>
                            </label>
                          ))}
                       </div>
                       <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 h-[500px] overflow-y-auto space-y-2">
                          <p className="text-[10px] font-black text-black uppercase tracking-widest px-2 mb-2">MODULE ASSIGNMENT</p>
                          {subjects.map(s => (
                            <label key={s.id} className="flex items-center gap-4 p-4 hover:bg-white rounded-3xl cursor-pointer transition-all">
                               <input type="checkbox" checked={formData.assignedSubjectIds?.includes(s.id)} onChange={() => handleCheckboxToggle('subjects', s.id)} className="w-6 h-6 accent-black" />
                               <span className="text-[11px] font-black uppercase">{s.name} ({classes.find(c => c.id === s.gradeId)?.name})</span>
                            </label>
                          ))}
                       </div>
                       <div className={`bg-emerald-50 p-6 rounded-[2.5rem] border-2 border-emerald-600 h-[500px] overflow-y-auto space-y-2 transition-all ${formData.role !== UserRole.SUBJECT_CLASS_TEACHER ? 'opacity-20 pointer-events-none grayscale' : 'opacity-100'}`}>
                          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest px-2 mb-4 flex items-center gap-2">
                             <i className="fas fa-crown"></i>
                             DESIGNATED CLASS
                          </p>
                          {classes.map(c => (
                            <label key={c.id} className="flex items-center gap-4 p-4 bg-white/50 hover:bg-white rounded-3xl cursor-pointer transition-all border border-emerald-100 mb-2">
                               <input type="checkbox" checked={formData.classTeacherOf?.includes(c.id)} onChange={() => handleCheckboxToggle('isClassTeacher', c.id)} className="w-6 h-6 accent-emerald-600" />
                               <span className="text-xs font-black uppercase text-emerald-900">{c.name}</span>
                            </label>
                          ))}
                          {classes.length === 0 && <p className="text-[10px] text-center text-emerald-300 py-20 italic">No Grade Nodes available</p>}
                       </div>
                    </div>
                 </div>
                 <button type="submit" className="w-full py-8 bg-black text-white rounded-[2.5rem] font-black uppercase shadow-2xl flex items-center justify-center gap-4 hover:bg-emerald-600 transition-all active:scale-95">
                    <i className="fas fa-save text-xl"></i>
                    COMMIT TO FACULTY VAULT
                 </button>
              </form>
           </div>
        </div>, document.body
      )}
    </div>
  );
};

export default Teachers;
