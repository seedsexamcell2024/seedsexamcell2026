
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ClassLevel } from '../types.ts';
import { saveData, loadData, getActiveSessionYear, getActiveTerm, performCascadingDelete } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';

const Classes = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ClassLevel>>({ name: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const syncStateFromVDB = useCallback(() => {
    const data = VDB.queryAll<ClassLevel>('classes');
    setClasses([...data].sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0)));
  }, []);

  useEffect(() => {
    // Instant local load
    loadData('classes').then(() => syncStateFromVDB());
    
    const handleUpdate = () => syncStateFromVDB();
    window.addEventListener('DATA_UPDATED', handleUpdate);
    return () => window.removeEventListener('DATA_UPDATED', handleUpdate);
  }, [syncStateFromVDB]);

  const commitToVault = async (newList: ClassLevel[]) => {
    setIsProcessing(true);
    const final = [...newList]
      .sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0))
      .map((c, idx) => ({ ...c, serialNumber: idx + 1 }));

    const success = await saveData('classes', final);
    if (success) {
      setClasses(final);
    }
    setIsProcessing(false);
  };

  const handleBulkSubmit = async () => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.split(/[\n,]+/).map(l => l.trim().toUpperCase()).filter(l => l !== '');
    const year = getActiveSessionYear();
    const term = getActiveTerm() as any;
    
    const currentList = VDB.queryAll<ClassLevel>('classes');
    const newNodes = lines.map((name, idx) => ({
      id: `CLS_${Math.random().toString(36).substr(2, 9)}_${Date.now()}_${idx}`,
      yearId: year,
      termId: term,
      serialNumber: currentList.length + idx + 1,
      name
    }));

    await commitToVault([...currentList, ...newNodes]);
    setIsBulkModalOpen(false);
    setBulkInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const currentList = VDB.queryAll<ClassLevel>('classes');

    if (editingId) {
      const updated = currentList.map(c => c.id === editingId ? { ...c, name: (formData.name || '').toUpperCase() } : c);
      await commitToVault(updated);
    } else {
      const newNode = {
        id: `CLS_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
        yearId: getActiveSessionYear(),
        termId: getActiveTerm() as any,
        serialNumber: currentList.length + 1,
        name: (formData.name || '').toUpperCase()
      };
      await commitToVault([...currentList, newNode]);
    }
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '' });
  };

  return (
    <div className="p-6 lg:p-12 space-y-8 animate-in pb-40 min-h-screen bg-slate-50 font-sans selection:bg-emerald-100">
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-8 rounded-[3rem] border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] gap-6">
        <div>
           <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Grade Node Registry</h3>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Institutional Foundation • Session {getActiveSessionYear()}</p>
        </div>
        <div className="flex flex-wrap gap-4">
           <button onClick={() => navigate('/')} className="w-14 h-14 bg-slate-100 border-2 border-black rounded-2xl flex items-center justify-center hover:bg-black hover:text-white transition-all"><i className="fas fa-home"></i></button>
           <button onClick={() => setIsBulkModalOpen(true)} className="px-8 py-3 bg-white border-4 border-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">BATCH REGISTRY</button>
           <button onClick={() => { setEditingId(null); setFormData({name: ''}); setIsModalOpen(true); }} className="px-10 py-3 bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 shadow-xl transition-all">APPEND GRADE</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {classes.map((cls) => (
          <div key={cls.id} className="bg-white border-4 border-black p-8 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all group flex flex-col justify-between min-h-[200px]">
            <div>
              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">NODE #{cls.serialNumber}</p>
              <h4 className="text-2xl font-black text-slate-950 uppercase tracking-tighter leading-tight">{cls.name}</h4>
            </div>
            <div className="flex gap-2 justify-end mt-4 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={() => { setEditingId(cls.id); setFormData(cls); setIsModalOpen(true); }} className="w-11 h-11 rounded-xl bg-slate-50 text-slate-400 hover:text-emerald-600 border border-slate-100 flex items-center justify-center shadow-sm"><i className="fas fa-edit"></i></button>
              <button onClick={() => { if(window.confirm(`Delete Grade node ${cls.name}?`)) performCascadingDelete('CLASS', cls.id).then(() => syncStateFromVDB()); }} className="w-11 h-11 rounded-xl bg-rose-50 text-rose-400 hover:text-rose-600 border border-rose-100 flex items-center justify-center shadow-sm"><i className="fas fa-trash-alt"></i></button>
            </div>
          </div>
        ))}
        {classes.length === 0 && (
           <div className="col-span-full py-40 text-center border-4 border-dashed border-slate-200 rounded-[4rem]">
              <i className="fas fa-layer-group text-6xl text-slate-100 mb-6"></i>
              <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Awaiting Grade Node Configuration</p>
           </div>
        )}
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in">
           <div className="bg-white rounded-[4rem] w-full max-w-lg shadow-2xl border-t-[20px] border-emerald-600 overflow-hidden">
              <div className="p-10 border-b flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase text-slate-900">Grade Config</h3>
                 <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-600 transition-all"><i className="fas fa-times"></i></button>
              </div>
              <form onSubmit={handleSubmit} className="p-10 space-y-6">
                 <input type="text" required className="w-full bg-slate-50 border-4 border-black rounded-3xl px-8 py-5 text-xl font-black uppercase outline-none focus:border-emerald-600 transition-all" placeholder="GRADE NAME" value={formData.name} onChange={e => setFormData({name: e.target.value})} autoFocus />
                 <button type="submit" className="w-full py-7 bg-slate-950 text-white rounded-3xl font-black uppercase shadow-2xl hover:bg-emerald-600 transition-all">COMMIT NODE</button>
              </form>
           </div>
        </div>, document.body
      )}

      {isBulkModalOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in">
           <div className="bg-white rounded-[4rem] w-full max-w-2xl shadow-2xl border-t-[20px] border-black overflow-hidden">
              <div className="p-10 border-b flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase text-slate-900">Mass Registry</h3>
                 <button onClick={() => setIsBulkModalOpen(false)} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-600 transition-all"><i className="fas fa-times"></i></button>
              </div>
              <div className="p-10 space-y-8">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed text-center">Paste class names separated by commas or new lines.<br/>(e.g. NURSERY, CLASS 1, CLASS 2)</p>
                 <textarea 
                    className="w-full h-64 bg-slate-50 border-4 border-black rounded-[2.5rem] p-8 text-sm font-black uppercase outline-none focus:ring-8 focus:ring-emerald-500/10 transition-all"
                    placeholder="ENTER BULK DATA..."
                    value={bulkInput}
                    onChange={e => setBulkInput(e.target.value)}
                 />
                 <button onClick={handleBulkSubmit} className="w-full py-8 bg-emerald-600 text-white rounded-[2.5rem] font-black uppercase shadow-2xl hover:bg-emerald-700 transition-all active:scale-95 text-lg">
                    INITIALIZE MASS UPLOAD
                 </button>
              </div>
           </div>
        </div>, document.body
      )}
    </div>
  );
};

export default Classes;
