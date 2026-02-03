
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Subject, ClassLevel } from '../types.ts';
import { saveData, loadData, getActiveSessionYear, getActiveTerm, performCascadingDelete } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';

const Subjects = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState('');
  
  // Input States
  const [customNewName, setCustomNewName] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState<'SINGLE' | 'BULK' | 'CLONE'>('SINGLE');
  
  // Clone Mode States
  const [cloneSourceId, setCloneSourceId] = useState('');
  const [selectedCloneIds, setSelectedCloneIds] = useState<string[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState('');

  const fetchResources = useCallback(async (force: boolean = false) => {
    setIsProcessing(true);
    // Explicitly load both subjects and classes to ensure dropdown is populated
    await Promise.all([
      loadData('subjects', force), 
      loadData('classes', force)
    ]);
    
    // Sync UI with the authoritative Virtual Database
    setSubjects([...VDB.queryAll<Subject>('subjects')].sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0)));
    setClasses([...VDB.queryAll<ClassLevel>('classes')].sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0)));
    
    setIsProcessing(false);
  }, []);

  useEffect(() => {
    fetchResources();
    const handleUpdate = () => {
       setSubjects([...VDB.queryAll<Subject>('subjects')].sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0)));
       setClasses([...VDB.queryAll<ClassLevel>('classes')].sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0)));
    };
    window.addEventListener('DATA_UPDATED', handleUpdate);
    return () => window.removeEventListener('DATA_UPDATED', handleUpdate);
  }, [fetchResources]);

  const saveToVault = async (newList: Subject[]) => {
    setIsProcessing(true);
    const success = await saveData('subjects', newList);
    if (success) {
        setSubjects(newList);
    }
    setIsProcessing(false);
    return success;
  };

  const subjectsInSourceClass = useMemo(() => {
    if (!cloneSourceId) return [];
    return subjects.filter(s => VDB.normalize(s.gradeId) === VDB.normalize(cloneSourceId));
  }, [cloneSourceId, subjects]);

  const handleAdd = async () => {
    if (!selectedGradeId) { alert("Please select a target Grade Node first."); return; }
    const yearId = getActiveSessionYear();
    const termId = getActiveTerm() as any;
    
    const latestSubjects = [...VDB.queryAll<Subject>('subjects')];

    if (isBulkMode === 'BULK') {
      const names = bulkInput.split(/[\n,]+/).map(n => n.trim().toUpperCase()).filter(n => n !== '');
      if (names.length === 0) return;
      const newEntries = names.map((name, index) => ({
        id: `SUB_${Math.random().toString(36).substr(2, 9)}_${Date.now()}_${index}`,
        yearId, termId, serialNumber: latestSubjects.length + index + 1, name, gradeId: selectedGradeId
      }));
      await saveToVault([...latestSubjects, ...newEntries]);
      setBulkInput('');
      setIsBulkMode('SINGLE');
    } else if (isBulkMode === 'CLONE') {
      if (selectedCloneIds.length === 0) { alert("Select modules to clone."); return; }
      
      const currentGradeSubjects = latestSubjects.filter(s => VDB.normalize(s.gradeId) === VDB.normalize(selectedGradeId)).map(s => s.name.toUpperCase());
      const clonedEntries = subjectsInSourceClass
        .filter(s => selectedCloneIds.includes(s.id))
        .filter(s => !currentGradeSubjects.includes(s.name.toUpperCase())) 
        .map((s, index) => ({
          id: `SUB_${Math.random().toString(36).substr(2, 9)}_${Date.now()}_CLONE_${index}`,
          yearId, termId, serialNumber: latestSubjects.length + index + 1, name: s.name, gradeId: selectedGradeId
        }));

      if (clonedEntries.length === 0) { alert("All selected modules already exist in the target class."); return; }
      await saveToVault([...latestSubjects, ...clonedEntries]);
      setSelectedCloneIds([]);
      setIsBulkMode('SINGLE');
    } else {
      if (!customNewName) return;
      const newEntry = { 
        id: `SUB_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`, 
        yearId, termId, serialNumber: latestSubjects.length + 1, name: customNewName.toUpperCase(), gradeId: selectedGradeId 
      };
      await saveToVault([...latestSubjects, newEntry]);
      setCustomNewName('');
    }
  };

  const toggleCloneSelection = (id: string) => {
    setSelectedCloneIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="p-6 lg:p-12 space-y-8 animate-in pb-40 min-h-screen bg-slate-50 font-sans selection:bg-teal-100">
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-8 rounded-[3rem] border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] gap-8">
        <div className="flex-1 space-y-4 w-full">
           <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black uppercase tracking-tighter">Module Registry</h1>
              <div className="h-2 w-2 rounded-full bg-teal-500"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Curriculum Mapping</p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Target Grade Node</p>
                <select className="w-full bg-slate-50 border-2 border-black rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-teal-500/10" value={selectedGradeId} onChange={e => setSelectedGradeId(e.target.value)}>
                   <option value="">SELECT TARGET GRADE ({classes.length} NODES)</option>
                   {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">Registry Method</p>
                <div className="flex bg-slate-100 p-1 rounded-2xl border-2 border-black">
                   <button onClick={() => setIsBulkMode('SINGLE')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${isBulkMode === 'SINGLE' ? 'bg-black text-white shadow-lg' : 'text-slate-400'}`}>Single</button>
                   <button onClick={() => setIsBulkMode('BULK')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${isBulkMode === 'BULK' ? 'bg-black text-white shadow-lg' : 'text-slate-400'}`}>Bulk</button>
                   <button onClick={() => setIsBulkMode('CLONE')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${isBulkMode === 'CLONE' ? 'bg-black text-white shadow-lg' : 'text-slate-400'}`}>Clone</button>
                </div>
              </div>
           </div>

           {isBulkMode === 'BULK' && (
              <div className="animate-in">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2">Mixed format supported (Maths, English, Science...)</p>
                <textarea className="w-full bg-slate-50 border-2 border-black rounded-3xl p-6 text-xs font-black uppercase h-32 outline-none focus:bg-white transition-all" placeholder="Enter Subjects separated by commas or new lines..." value={bulkInput} onChange={e => setBulkInput(e.target.value)} />
              </div>
           )}

           {isBulkMode === 'SINGLE' && (
              <div className="animate-in">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2">Subject Title</p>
                <input type="text" className="w-full bg-slate-50 border-2 border-black rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none focus:bg-white transition-all" placeholder="Enter Module Name (e.g. Mathematics)" value={customNewName} onChange={e => setCustomNewName(e.target.value)} />
              </div>
           )}

           {isBulkMode === 'CLONE' && (
              <div className="animate-in space-y-4">
                <div className="p-6 bg-teal-50 border-2 border-dashed border-teal-200 rounded-3xl">
                   <p className="text-[9px] font-black text-teal-800 uppercase tracking-widest mb-4">Choose Source Class to Clone From</p>
                   <select className="w-full bg-white border-2 border-black rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none" value={cloneSourceId} onChange={e => { setCloneSourceId(e.target.value); setSelectedCloneIds(subjects.filter(s => VDB.normalize(s.gradeId) === VDB.normalize(e.target.value)).map(s => s.id)); }}>
                      <option value="">SOURCE CLASS...</option>
                      {classes.filter(c => VDB.normalize(c.id) !== VDB.normalize(selectedGradeId)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>

                   {cloneSourceId && (
                      <div className="mt-6 space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                         {subjectsInSourceClass.map(s => (
                            <label key={s.id} className="flex items-center justify-between p-3 bg-white border border-teal-100 rounded-xl cursor-pointer hover:border-teal-400 transition-all">
                               <span className="text-[10px] font-black uppercase">{s.name}</span>
                               <input type="checkbox" checked={selectedCloneIds.includes(s.id)} onChange={() => toggleCloneSelection(s.id)} className="w-5 h-5 accent-teal-600" />
                            </label>
                         ))}
                         {subjectsInSourceClass.length === 0 && <p className="text-[9px] text-center text-teal-400 py-4 uppercase font-black">No subjects found in source</p>}
                      </div>
                   )}
                </div>
              </div>
           )}
        </div>
        <div className="flex flex-col gap-4">
           <button onClick={() => navigate('/')} className="w-14 h-14 bg-slate-100 border-2 border-black rounded-2xl flex items-center justify-center hover:bg-black hover:text-white transition-all self-end"><i className="fas fa-home"></i></button>
           <button onClick={handleAdd} disabled={isProcessing} className={`bg-slate-950 text-white px-12 py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-teal-600 transition-all shadow-xl active:scale-95 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
             {isProcessing ? 'PROCESSING...' : 'COMMIT TO CURRICULUM'}
           </button>
        </div>
      </div>

      {/* REGISTRY LISTING */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {classes.map(c => {
          const classSubjects = subjects.filter(s => VDB.normalize(s.gradeId) === VDB.normalize(c.id));
          return (
            <div key={c.id} className={`bg-white border-4 border-black p-8 rounded-[3.5rem] shadow-sm flex flex-col min-h-[350px] relative overflow-hidden group transition-all ${VDB.normalize(selectedGradeId) === VDB.normalize(c.id) ? 'ring-8 ring-teal-500/20 shadow-2xl' : ''}`}>
               <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-[4rem] group-hover:bg-teal-50 transition-colors"></div>
               <h4 className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-100 pb-4 mb-6 relative z-10 flex items-center gap-3">
                  <span className={`w-2 h-6 rounded-full ${VDB.normalize(selectedGradeId) === VDB.normalize(c.id) ? 'bg-teal-500 animate-pulse' : 'bg-black'}`}></span>
                  {c.name} 
                  <span className="ml-auto bg-slate-900 text-white px-3 py-1 rounded-lg text-[8px]">{classSubjects.length} MODULES</span>
               </h4>
               <div className="flex-1 space-y-3">
                  {classSubjects.map(s => (
                    <div key={s.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-4 rounded-2xl hover:bg-white hover:border-teal-500 transition-all group/item">
                       <span className="text-[10px] font-black text-slate-900 uppercase">{s.name}</span>
                       <div className="flex gap-2 opacity-0 group-hover/item:opacity-100 transition-all">
                          <button onClick={() => { setEditingSubjectId(s.id); setEditingSubjectName(s.name); }} className="w-9 h-9 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-teal-600 flex items-center justify-center transition-all"><i className="fas fa-edit text-xs"></i></button>
                          <button onClick={() => { if(window.confirm(`Delete module ${s.name}?`)) performCascadingDelete('SUBJECT', s.id).then(() => fetchResources(true)); }} className="w-9 h-9 bg-rose-50 border border-rose-100 rounded-xl text-rose-400 hover:text-rose-600 flex items-center justify-center transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                       </div>
                    </div>
                  ))}
                  {classSubjects.length === 0 && (
                     <div className="flex flex-col items-center justify-center py-20 opacity-20 italic">
                        <i className="fas fa-book-open text-3xl mb-3"></i>
                        <p className="text-[9px] font-black uppercase">Vacant Ledger</p>
                     </div>
                  )}
               </div>
               {VDB.normalize(selectedGradeId) !== VDB.normalize(c.id) && (
                  <button onClick={() => setSelectedGradeId(c.id)} className="absolute bottom-6 right-8 w-10 h-10 bg-slate-100 text-slate-400 rounded-full border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-teal-500 hover:text-white hover:border-teal-600">
                    <i className="fas fa-plus"></i>
                  </button>
               )}
            </div>
          );
        })}
      </div>

      {editingSubjectId && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in">
           <div className="bg-white rounded-[4rem] w-full max-w-lg shadow-2xl border-t-[16px] border-teal-600 overflow-hidden">
              <div className="p-10 border-b flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase text-slate-900">Edit Module</h3>
                 <button onClick={() => setEditingSubjectId(null)} className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-600"><i className="fas fa-times"></i></button>
              </div>
              <div className="p-10 space-y-6">
                 <input type="text" className="w-full bg-slate-50 border-4 border-black rounded-3xl px-8 py-5 text-xl font-black uppercase outline-none focus:border-teal-600" value={editingSubjectName} onChange={e => setEditingSubjectName(e.target.value)} autoFocus />
                 <button onClick={async () => {
                    const latest = VDB.queryAll<Subject>('subjects');
                    const updated = latest.map(s => s.id === editingSubjectId ? { ...s, name: editingSubjectName.toUpperCase() } : s);
                    await saveToVault(updated);
                    setEditingSubjectId(null);
                 }} className="w-full py-7 bg-slate-950 text-white rounded-3xl font-black uppercase shadow-2xl hover:bg-teal-600">SAVE PROTOCOL</button>
              </div>
           </div>
        </div>, document.body
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Subjects;
