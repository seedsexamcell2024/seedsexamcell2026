
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loadData, saveData, purgeAndReboot } from '../services/dbService.ts';
import { PERMANENT_CONFIG, getCloudUrl, setCloudUrl } from '../config.ts';
import { generateGoogleDeploymentScript } from '../services/googleHostingService.ts';
import { testCloudConnection } from '../services/sheetService.ts';

const Admin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const [activeTab, setActiveTab] = useState(queryParams.get('tab') || 'branding');
  const [schoolName, setSchoolName] = useState(localStorage.getItem('schoolName') || PERMANENT_CONFIG.name);
  const [schoolLogo, setSchoolLogo] = useState(localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram);
  const [cloudUrl, setCloudUrlState] = useState(getCloudUrl());
  const [passInput, setPassInput] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ok: boolean, msg: string} | null>(null);

  useEffect(() => {
     loadData('identity').then(data => {
       if (data && data[0]) {
         setSchoolName(data[0].schoolName || schoolName);
         setSchoolLogo(data[0].schoolLogo || schoolLogo);
       }
     });
  }, []);

  const runConnectivityTest = useCallback(async () => {
    if (!cloudUrl) return;
    setIsTesting(true);
    const res = await testCloudConnection(cloudUrl);
    setTestResult(res);
    setIsTesting(false);
  }, [cloudUrl]);

  // AUTOMATIC PULSE TRIGGER
  useEffect(() => {
    if (isAuthorized && activeTab === 'cloud') {
      runConnectivityTest();
    }
  }, [isAuthorized, activeTab, runConnectivityTest]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const vault = JSON.parse(localStorage.getItem('security_vault') || '{"admin":"admin"}');
    if (passInput.toLowerCase() === vault.admin.toLowerCase()) setIsAuthorized(true);
    else alert("Access Denied.");
  };

  const handleBrandingSave = async () => {
    localStorage.setItem('schoolName', schoolName);
    localStorage.setItem('schoolLogo', schoolLogo);
    const success = await saveData('identity', [{ id: 'IDENTITY_NODE', schoolName, schoolLogo }]);
    if (success) alert("Branding Profile Secured.");
    else alert("Institutional Vault Write Error.");
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3.5rem] border-[8px] border-black w-full max-w-md shadow-2xl text-center animate-in">
          <i className="fas fa-shield-alt text-6xl text-emerald-500 mb-8"></i>
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-8">Executive Auth</h2>
          <form onSubmit={handleAuth} className="space-y-6">
            <input type="password" placeholder="ADMIN SIGNATURE" className="w-full bg-slate-50 border-4 border-black rounded-[1.5rem] py-5 text-center text-xl font-black outline-none focus:border-emerald-500 transition-all" value={passInput} onChange={e => setPassInput(e.target.value)} autoFocus />
            <button className="w-full py-6 bg-black text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all active:scale-95">INITIALIZE ACCESS</button>
            <button type="button" onClick={() => navigate('/')} className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Return to Core</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-12 pb-40 font-sans selection:bg-emerald-100">
      <div className="max-w-5xl mx-auto space-y-10 animate-in">
        <div className="flex items-center justify-between">
           <div>
             <h1 className="text-4xl font-black text-slate-950 uppercase tracking-tighter leading-none">Vault Control</h1>
             <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2">Verified Destination: {PERMANENT_CONFIG.email}</p>
           </div>
           <button onClick={() => navigate('/')} className="px-8 py-3 bg-white border-4 border-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">Exit Control</button>
        </div>

        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-[2.5rem] border-4 border-black shadow-lg">
          {['branding', 'cloud', 'security', 'system'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex-1 ${activeTab === t ? 'bg-black text-white shadow-xl scale-105' : 'text-slate-400 hover:text-black hover:bg-slate-50'}`}>
              {t}
            </button>
          ))}
        </div>

        {activeTab === 'branding' && (
          <div className="bg-white p-12 rounded-[4rem] border-4 border-black shadow-2xl space-y-12 animate-in">
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 text-slate-950">Institutional Identity</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configure visual sovereignty for reports and dashboard</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
               <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Official Institution Name</p>
                    <input value={schoolName} onChange={e => setSchoolName(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-4 border-black rounded-[1.5rem] px-6 py-5 font-black uppercase text-base outline-none focus:border-emerald-500 transition-all shadow-inner" />
                  </div>
                  <div className="bg-emerald-50 p-6 rounded-3xl border-2 border-emerald-100 italic">
                    <p className="text-[10px] text-emerald-800 font-bold leading-relaxed">Identity locks for account: {PERMANENT_CONFIG.email}</p>
                  </div>
               </div>
               <div className="text-center space-y-6">
                  <div className="w-56 h-56 mx-auto bg-slate-50 border-4 border-dashed border-slate-200 rounded-[4rem] p-8 flex items-center justify-center relative group overflow-hidden transition-all hover:border-emerald-500 hover:bg-white shadow-inner">
                     <img src={schoolLogo} className="max-w-full max-h-full object-contain drop-shadow-xl" />
                     <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white cursor-pointer gap-2">
                        <i className="fas fa-camera text-3xl mb-1"></i>
                        <span className="text-[9px] font-black uppercase tracking-widest">Update Monogram</span>
                        <input type="file" className="hidden" accept="image/*" onChange={e => {
                           const f = e.target.files?.[0];
                           if(f) {
                             const r = new FileReader();
                             r.onload = ev => setSchoolLogo(ev.target?.result as string);
                             r.readAsDataURL(f);
                           }
                        }} />
                     </label>
                  </div>
               </div>
            </div>
            <button onClick={handleBrandingSave} className="w-full py-8 bg-emerald-600 text-white rounded-[2.5rem] font-black uppercase shadow-2xl hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-4">
               <i className="fas fa-shield-check text-xl"></i>
               SECURE BRANDING PROTOCOL
            </button>
          </div>
        )}

        {activeTab === 'cloud' && (
          <div className="bg-white p-12 rounded-[4rem] border-4 border-black shadow-2xl space-y-10 animate-in">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center text-3xl shadow-inner border border-blue-100"><i className="fas fa-cloud-upload-alt"></i></div>
              <div>
                <h3 className="text-3xl font-black uppercase tracking-tighter">Migration Audit Console</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Status Check for: seedsexamcell2024@gmail.com</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6">
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 space-y-6 shadow-inner">
                     <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Current Cloud Path</h4>
                     <input 
                       value={cloudUrl} 
                       onChange={e => setCloudUrlState(e.target.value)} 
                       className="w-full bg-white border-4 border-black rounded-[1.5rem] px-8 py-5 text-xs font-bold outline-none focus:border-blue-500 transition-all shadow-md" 
                       placeholder="https://script.google.com/macros/s/..." 
                     />
                     <div className="flex gap-3">
                        <button 
                          onClick={() => { setCloudUrl(cloudUrl); alert("CLOUD BRIDGE ENABLED. All academic data packets are now routing to the new node."); runConnectivityTest(); }} 
                          className="flex-1 py-5 bg-slate-950 text-white rounded-[1.5rem] font-black uppercase text-[9px] tracking-widest shadow-xl hover:bg-blue-600 transition-all"
                        >
                          SAVE NEW PATH
                        </button>
                        <button 
                          onClick={runConnectivityTest}
                          disabled={isTesting}
                          className="px-8 py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black uppercase text-[9px] tracking-widest shadow-xl hover:bg-emerald-700 transition-all flex items-center gap-2"
                        >
                          {isTesting ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-broadcast-tower"></i>}
                          REFRESH PULSE
                        </button>
                     </div>
                     {testResult && (
                        <div className={`p-4 rounded-2xl border-2 flex items-center gap-3 animate-in ${testResult.ok ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-rose-50 border-rose-500 text-rose-700'}`}>
                           <i className={`fas ${testResult.ok ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                           <span className="text-[10px] font-black uppercase tracking-widest">{testResult.msg}</span>
                        </div>
                     )}
                     {!testResult && isTesting && (
                        <div className="p-4 rounded-2xl border-2 bg-blue-50 border-blue-200 text-blue-700 flex items-center gap-3 animate-pulse">
                           <i className="fas fa-satellite-dish"></i>
                           <span className="text-[10px] font-black uppercase tracking-widest">Autonomous Sync Handshake...</span>
                        </div>
                     )}
                  </div>

                  <div className="bg-amber-50 p-8 rounded-[2.5rem] border-2 border-amber-200">
                     <h4 className="text-sm font-black uppercase tracking-widest text-amber-900 flex items-center gap-3">
                        <i className="fas fa-info-circle"></i> Migration Confirmation
                     </h4>
                     <p className="text-[11px] text-amber-800 font-bold uppercase leading-relaxed mt-4">
                        The system now automatically pings the vault. If <b>BRIDGE READY</b> appears above, your database is 100% migrated to <b>seedsexamcell2024@gmail.com</b>.
                     </p>
                  </div>
               </div>

               <div className="bg-slate-900 p-8 rounded-[3rem] border-4 border-black space-y-6 relative overflow-hidden flex flex-col">
                  <div className="relative z-10 space-y-4 flex-1">
                     <h4 className="text-white text-xl font-black uppercase tracking-widest flex items-center gap-3">
                        <i className="fas fa-terminal text-emerald-500"></i> Master Script Code
                     </h4>
                     <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase">
                        PASTE THIS IN THE SCRIPT EDITOR OF THE NEW ACCOUNT'S GOOGLE SHEET.
                     </p>
                     <textarea 
                        readOnly 
                        className="w-full h-80 bg-black/50 text-emerald-400 p-8 rounded-[2rem] font-mono text-[9px] border-2 border-white/5 shadow-inner focus:outline-none scrollbar-hide"
                        value={generateGoogleDeploymentScript(PERMANENT_CONFIG.name)}
                     />
                     <button 
                        onClick={() => { navigator.clipboard.writeText(generateGoogleDeploymentScript(PERMANENT_CONFIG.name)); alert("SCRIPT SECURED: Paste into Google Apps Script editor."); }}
                        className="w-full py-6 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-500 transition-all flex items-center justify-center gap-3 active:scale-95"
                     >
                        <i className="fas fa-copy text-xl"></i> COPY MASTER SCRIPT
                     </button>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="bg-white p-12 rounded-[4rem] border-4 border-black shadow-2xl space-y-8 animate-in">
            <div className="flex items-center gap-6"><div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center text-3xl shadow-inner border border-rose-100"><i className="fas fa-microchip"></i></div><h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Core Diagnostics</h3></div>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Emergency protocols for account transitions. Purging will clear local cache, forcing a fresh download from the NEW cloud node.</p>
            <button onClick={purgeAndReboot} className="w-full py-8 bg-rose-600 text-white rounded-[2.5rem] font-black uppercase shadow-2xl hover:bg-rose-700 transition-all flex items-center justify-center gap-4">
               <i className="fas fa-skull-crossbones"></i>
               PERFORM TOTAL SYSTEM PURGE
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
