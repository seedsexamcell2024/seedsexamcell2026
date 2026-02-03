
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERMANENT_CONFIG } from '../config.ts';
import { setActiveSessionYear, setActiveTerm, loadData } from '../services/dbService.ts';

const StaffLogin = () => {
  const navigate = useNavigate();
  const [passkey, setPasskey] = useState('');
  const [error, setError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [selectedTerm, setSelectedTerm] = useState('1st');
  
  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passkey) {
        setError(true);
        return;
    }

    const vaultData = localStorage.getItem('security_vault');
    const vault = vaultData ? JSON.parse(vaultData) : { admin: 'admin', staff: 'staff' };
    
    let role = null;
    const cleanKey = passkey.toLowerCase().trim();
    if (cleanKey === vault.admin.toLowerCase()) role = 'ADMIN';
    else if (cleanKey === vault.staff.toLowerCase() || cleanKey === 'teacher' || cleanKey === 'staff') role = 'TEACHER';

    if (role) {
      setIsSyncing(true);
      setActiveSessionYear(selectedYear);
      setActiveTerm(selectedTerm);
      
      localStorage.setItem('session_role', role);
      
      // Start background sync
      loadData('identity', true).catch(err => console.warn("Background Sync Initializing...", err));
      
      window.dispatchEvent(new Event('LOGIN_SUCCESS'));
      navigate('/welcome');
    } else {
      setError(true);
      setPasskey('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row font-sans overflow-hidden">
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex flex-col justify-center p-12 lg:p-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        <div className="relative z-10 space-y-8 animate-in">
           <div className="w-24 h-24 bg-white rounded-[2.5rem] p-5 shadow-2xl border-4 border-emerald-500/20"><img src={logo} className="w-full h-full object-contain" alt="SEEDS" /></div>
           <div>
             <h1 className="text-4xl lg:text-7xl font-black text-white uppercase tracking-tighter leading-none">
                SEEDS<br/><span className="text-emerald-500">EXECUTIVE</span>
             </h1>
             <p className="text-white/40 font-black uppercase tracking-[0.5em] text-[10px] mt-6">Institutional Management Hub v28.5</p>
           </div>
        </div>
      </div>

      <div className="w-full lg:w-[500px] bg-white p-12 lg:p-20 flex flex-col justify-center border-l-4 border-black">
        <div className="space-y-12 w-full max-w-sm mx-auto">
          <div className="animate-in" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-3xl font-black text-slate-950 uppercase tracking-tighter mb-2">Vault Entry</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Provide authorization signature</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6 animate-in" style={{ animationDelay: '0.2s' }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Session Year</label>
                 <select 
                   className="w-full bg-slate-50 border-2 border-black rounded-2xl px-4 py-3 text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
                   value={selectedYear}
                   onChange={e => setSelectedYear(e.target.value)}
                 >
                   {["2023-2024", "2024-2025", "2025-2026", "2026-2027"].map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Term</label>
                 <select 
                   className="w-full bg-slate-50 border-2 border-black rounded-2xl px-4 py-3 text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
                   value={selectedTerm}
                   onChange={e => setSelectedTerm(e.target.value)}
                 >
                   <option value="1st">1st Term</option>
                   <option value="2nd">2nd Term</option>
                 </select>
              </div>
            </div>
            <div className="space-y-6 pt-4">
              <div className="relative">
                <input 
                  type="password" 
                  placeholder="ENTRY PASSKEY" 
                  className={`w-full bg-slate-50 border-4 border-black rounded-[1.5rem] px-8 py-5 text-center text-lg font-black tracking-widest outline-none transition-all ${error ? 'border-rose-500 bg-rose-50 ring-4 ring-rose-500/10' : 'focus:border-emerald-500'}`}
                  value={passkey}
                  onChange={e => setPasskey(e.target.value)}
                  autoFocus
                />
                {error && <p className="absolute -bottom-6 left-0 right-0 text-center text-[8px] font-black text-rose-500 uppercase tracking-widest">Invalid Signature Detected</p>}
              </div>
              <button disabled={isSyncing} type="submit" className="w-full bg-slate-950 text-white py-6 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.4em] shadow-[8px_8px_0px_rgba(0,0,0,0.15)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3">
                {isSyncing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-lock-open"></i>}
                {isSyncing ? 'AUTHORIZING...' : 'INITIALIZE SESSION'}
              </button>
            </div>
          </form>
          <div className="pt-8 text-center opacity-30">
             <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Institutional Sovereignty via UVP v7.0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffLogin;
