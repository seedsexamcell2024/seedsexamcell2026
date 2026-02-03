
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Student, ClassLevel, Subject } from '../types.ts';
import { saveData, loadData, getActiveSessionYear, performCascadingDelete } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';

const Students = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Student>>({
    name: '', rollNumber: '', gradeId: '', parentName: '', parentPhone: '',
    enrolledSubjects: [], dateOfAdmission: new Date().toISOString().split('T')[0],
    photo: ''
  });

  const fetchResources = useCallback(async (force: boolean = false) => {
      setIsProcessing(true);
      await Promise.allSettled([
        loadData('students', force), 
        loadData('classes', force),
        loadData('subjects', force)
      ]);
      setStudents([...VDB.queryAll<Student>('students')].sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0)));
      setClasses(VDB.queryAll<ClassLevel>('classes'));
      setIsProcessing(false);
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const commitToVault = async (newList: Student[]) => {
    setIsProcessing(true);
    const final = [...newList]
      .sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0))
      .map((s, idx) => ({ ...s, serialNumber: idx + 1 }));

    const success = await saveData('students', final);
    if (success) setStudents(final);
    setIsProcessing(false);
  };

  const handleBulkEnroll = async () => {
    if (!formData.gradeId) { alert("Select Grade node first."); return; }
    const lines = bulkInput.split('\n').filter(l => l.trim() !== '');
    const sessionYear = getActiveSessionYear();
    
    const newStudents = lines.map((line, idx) => {
      const parts = line.split(/[,|\t]+/).map(p => p.trim());
      const name = parts[0]?.toUpperCase() || 'UNKNOWN CANDIDATE';
      const roll = parts[1]?.toUpperCase() || `ROLL-${Date.now()}-${idx}`;
      return {
        id: `STU_${Math.random().toString(36).substr(2, 9)}_${Date.now()}_${idx}`,
        serialNumber: students.length + idx + 1,
        name, rollNumber: roll,
        gradeId: formData.gradeId!,
        yearId: sessionYear,
        termId: 'GLOBAL' as any,
        enrolledSubjects: VDB.queryAll<Subject>('subjects')
                           .filter(s => VDB.normalize(s.gradeId) === VDB.normalize(formData.gradeId))
                           .map(s => s.id)
      } as Student;
    });

    await commitToVault([...students, ...newStudents]);
    setIsBulkOpen(false);
    setBulkInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entryData = {
      ...formData,
      name: (formData.name || '').toUpperCase(),
      rollNumber: (formData.rollNumber || '').toUpperCase(),
      parentName: (formData.parentName || '').toUpperCase(),
      yearId: getActiveSessionYear(),
      termId: 'GLOBAL' as any
    };

    if (editingId) {
      const updated = students.map(s => s.id === editingId ? { ...s, ...entryData } as Student : s);
      await commitToVault(updated);
    } else {
      const newNode = {
        id: `STU_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
        serialNumber: students.length + 1,
        ...entryData
      } as Student;
      await commitToVault([...students, newNode]);
    }
    setIsModalOpen(false); 
    setEditingId(null);
    setFormData({ name: '', rollNumber: '', gradeId: '', parentName: '', parentPhone: '', enrolledSubjects: [], dateOfAdmission: new Date().toISOString().split('T')[0], photo: '' });
  };

  const filteredSubjectsForClass = useMemo(() => {
    if (!formData.gradeId) return [];
    return VDB.queryAll<Subject>('subjects').filter(s => VDB.normalize(s.gradeId) === VDB.normalize(formData.gradeId));
  }, [formData.gradeId, students]);

  return (
    <div className="p-6 lg:p-12 space-y-8 animate-in pb-40 min-h-screen bg-slate-50 font-sans">
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-8 rounded-[3rem] border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Candidate Registry</h1>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mt-1">Personnel Entry Protocol • Session {getActiveSessionYear()}</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => navigate('/')} className="w-14 h-14 bg-slate-100 border-2 border-black rounded-2xl flex items-center justify-center hover:bg-black hover:text-white transition-all"><i className="fas fa-home"></i></button>
          <button onClick={() => { setFormData({...formData, enrolledSubjects: []}); setIsBulkOpen(true); }} className="px-8 py-3 bg-white border-4 border-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">MASS ENROLLMENT</button>
          <button onClick={() => { setEditingId(null); setFormData({ name: '', rollNumber: '', gradeId: '', parentName: '', parentPhone: '', enrolledSubjects: [], dateOfAdmission: new Date().toISOString().split('T')[0], photo: '' }); setIsModalOpen(true); }} className="px-10 py-3 bg-slate-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-xl">APPEND SINGLE ENTRY</button>
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border-4 border-black">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest">
                <th className="p-6 text-center w-20 border-r border-slate-800">S#</th>
                <th className="p-6 text-left border-r border-slate-800">Identity Profile</th>
                <th className="p-6 text-center border-r border-slate-800">Grade Cluster</th>
                <th className="p-6 text-center border-r border-slate-800">Registry Key</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-all">
                  <td className="p-4 text-center font-black text-slate-300 text-[11px]">#{s.serialNumber}</td>
                  <td className="p-4 font-black uppercase text-slate-950 text-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border-2 border-black/5 flex items-center justify-center shrink-0">
                        {s.photo ? <img src={s.photo} className="w-full h-full object-cover" /> : <i className="fas fa-user-graduate text-slate-300"></i>}
                      </div>
                      <div>{s.name}</div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="bg-black text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md">
                      {classes.find(c => c.id === s.gradeId)?.name || 'UNLINKED'}
                    </span>
                  </td>
                  <td className="p-4 text-center font-mono text-emerald-600 font-black text-xs uppercase tracking-widest">{s.rollNumber}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-3 pr-4">
                      <button onClick={() => { setEditingId(s.id); setFormData(s); setIsModalOpen(true); }} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-emerald-600 transition-all shadow-sm"><i className="fas fa-edit"></i></button>
                      <button onClick={() => { if(window.confirm(`Purge ${s.name}?`)) performCascadingDelete('STUDENT', s.id).then(() => fetchResources(true)); }} className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-400 hover:text-rose-600 transition-all shadow-sm"><i className="fas fa-trash-alt"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {students.length === 0 && (
            <div className="py-40 text-center flex flex-col items-center opacity-20">
                <i className="fas fa-user-astronaut text-7xl mb-6"></i>
                <h3 className="text-xl font-black uppercase tracking-widest">Registry Vault Empty</h3>
            </div>
        )}
      </div>

      {isBulkOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in">
           <div className="bg-white rounded-[4rem] w-full max-w-2xl shadow-2xl border-t-[20px] border-emerald-600 overflow-hidden">
              <div className="p-10 border-b flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase text-slate-900">Mass Enrollment Node</h3>
                 <button onClick={() => setIsBulkOpen(false)} className="text-slate-300 hover:text-rose-600"><i className="fas fa-times-circle text-4xl"></i></button>
              </div>
              <div className="p-10 space-y-6">
                 <select className="w-full bg-slate-50 border-4 border-black rounded-3xl px-8 py-5 text-sm font-black uppercase outline-none" value={formData.gradeId} onChange={e => setFormData({...formData, gradeId: e.target.value})}>
                    <option value="">SELECT TARGET GRADE FOR BATCH</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Format: Candidate Name, RollNumber (One per line)</p>
                 <textarea className="w-full h-64 bg-slate-50 border-4 border-black rounded-[2rem] p-8 text-sm font-black uppercase outline-none" placeholder="AAMIR KHAN, 101&#10;ZEESHAN ALI, 102" value={bulkInput} onChange={e => setBulkInput(e.target.value)} />
                 <button onClick={handleBulkEnroll} className="w-full py-8 bg-emerald-600 text-white rounded-[2.5rem] font-black uppercase shadow-2xl hover:bg-emerald-700 transition-all">INITIALIZE BATCH ENTRY</button>
              </div>
           </div>
        </div>, document.body
      )}

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in">
           <div className="bg-white rounded-[4rem] w-full max-w-4xl h-[85vh] shadow-2xl border-t-[20px] border-emerald-600 flex flex-col overflow-hidden">
              <div className="p-12 border-b flex justify-between items-center">
                 <h3 className="text-3xl font-black uppercase text-slate-900">Identity Configuration</h3>
                 <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-rose-600"><i className="fas fa-times-circle text-4xl"></i></button>
              </div>
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-12 space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                       <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-4 border-black rounded-3xl px-8 py-5 text-sm font-black uppercase outline-none focus:border-emerald-600" placeholder="FULL CANDIDATE NAME" required />
                       <input value={formData.rollNumber} onChange={e => setFormData({...formData, rollNumber: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-4 border-black rounded-3xl px-8 py-5 text-sm font-black uppercase outline-none focus:border-emerald-600" placeholder="REGISTRY ID / ROLL #" required />
                       <select className="w-full bg-slate-50 border-4 border-black rounded-3xl px-8 py-5 text-sm font-black uppercase outline-none" value={formData.gradeId} onChange={e => setFormData({...formData, gradeId: e.target.value})} required>
                          <option value="">TARGET GRADE NODE</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-6">
                       <input value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-4 border-black rounded-3xl px-8 py-5 text-sm font-black uppercase outline-none" placeholder="GUARDIAN NAME" />
                       <input value={formData.parentPhone} onChange={e => setFormData({...formData, parentPhone: e.target.value})} className="w-full bg-slate-50 border-4 border-black rounded-3xl px-8 py-5 text-sm font-black outline-none" placeholder="CONTACT (WHATSAPP)" />
                       <div className="bg-slate-950 p-6 rounded-3xl border-2 border-emerald-500/20 text-white space-y-4 max-h-48 overflow-y-auto">
                          <p className="text-[10px] font-black uppercase text-emerald-400">Automatic Module Mapping</p>
                          {filteredSubjectsForClass.map(s => (
                             <div key={s.id} className="flex items-center gap-3 text-[10px] font-black uppercase opacity-60">
                                <i className="fas fa-check-circle text-emerald-500"></i> {s.name}
                             </div>
                          ))}
                          {filteredSubjectsForClass.length === 0 && <p className="text-[9px] opacity-30 italic">No modules found for class</p>}
                       </div>
                    </div>
                 </div>
                 <button type="submit" className="w-full py-8 bg-slate-950 text-white rounded-[3rem] font-black uppercase shadow-2xl hover:bg-emerald-600 transition-all">SECURE PERSONNEL RECORD</button>
              </form>
           </div>
        </div>, document.body
      )}
    </div>
  );
};

export default Students;
