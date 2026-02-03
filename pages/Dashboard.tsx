
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loadData, getActiveSessionYear, getActiveTerm, setActiveTerm, purgeAndReboot } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

const ActionTile = ({ to, icon, label, sub, color, dark = false, highlight = false }: any) => (
  <Link 
    to={to} 
    className={`group relative ${dark ? 'bg-slate-900 border-slate-800 shadow-2xl' : highlight ? 'bg-blue-600 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)]' : 'bg-white border-black shadow-[6px_6px_0px_rgba(0,0,0,1)]'} rounded-[2.5rem] p-8 border-4 transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none flex flex-col justify-between min-h-[180px] overflow-hidden`}
  >
    <div className={`w-14 h-14 ${highlight ? 'bg-white text-blue-600' : color} ${highlight ? '' : 'text-white'} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all`}>
      <i className={`${icon} text-2xl`}></i>
    </div>
    <div className="relative z-10">
      <h3 className={`text-sm font-black uppercase tracking-tighter mb-1 ${dark || highlight ? 'text-white' : 'text-slate-950'}`}>{label}</h3>
      <p className={`text-[8px] font-black uppercase tracking-widest leading-relaxed ${dark ? 'text-slate-500' : highlight ? 'text-blue-100' : 'text-slate-400'}`}>{sub}</p>
    </div>
    {highlight && (
      <div className="absolute top-4 right-4 animate-pulse">
        <div className="w-3 h-3 bg-white rounded-full"></div>
      </div>
    )}
  </Link>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem('session_role') === 'ADMIN';
  const activeYear = getActiveSessionYear();
  const [activeTerm, setActiveTermState] = useState(getActiveTerm());
  const [dataVersion, setDataVersion] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBridgeReady, setIsBridgeReady] = useState(false);

  const syncVault = useCallback(async () => {
    setIsSyncing(true);
    try {
      await loadData('identity', true);
      setIsBridgeReady(true);
      setDataVersion(v => v + 1);
    } catch (err) {
      console.warn("Background Sync Delayed:", err);
      setIsBridgeReady(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    syncVault();
    const handleUpdate = () => setDataVersion(v => v + 1);
    window.addEventListener('DATA_UPDATED', handleUpdate);
    return () => window.removeEventListener('DATA_UPDATED', handleUpdate);
  }, [syncVault]);

  const handleTermSwitch = async (term: string) => {
    if (term === activeTerm) return;
    setIsSyncing(true);
    setActiveTerm(term);
    setActiveTermState(term);
    await loadData('identity', true);
    setIsSyncing(false);
    setDataVersion(v => v + 1);
  };

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  return (
    <div className="bg-[#f8fafc] min-h-screen p-4 lg:p-12 animate-in pb-40">
      {/* EXECUTIVE HEADER WITH MIGRATION STATUS */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center bg-white p-8 rounded-[3.5rem] border-4 border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] mb-12 gap-8 relative overflow-hidden">
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-20 h-20 bg-slate-50 rounded-[2rem] p-3 border-2 border-black/5 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
             <img src={logo} className="max-w-full max-h-full object-contain drop-shadow-md" alt="Logo" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-950 uppercase tracking-tighter leading-none">
              {localStorage.getItem('schoolName') || PERMANENT_CONFIG.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3">
               <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 transition-all ${isBridgeReady ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
                  {isBridgeReady && <span className="relative flex h-2 w-2 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>}
                  <i className="fas fa-cloud"></i> BRIDGE READY: {PERMANENT_CONFIG.email}
               </span>
               {isSyncing && (
                 <span className="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-circle-notch fa-spin"></i> Integrity Sync
                 </span>
               )}
               <div className="h-1 w-1 rounded-full bg-slate-200"></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Session {activeYear}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
           <div className="bg-slate-100 p-1.5 rounded-2xl border-2 border-black flex">
              {['1st', '2nd'].map(term => (
                <button 
                  key={term} 
                  onClick={() => handleTermSwitch(term)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTerm === term ? 'bg-black text-white shadow-lg' : 'text-slate-400 hover:text-black'}`}
                >
                  {term} Term
                </button>
              ))}
           </div>
           <button onClick={() => purgeAndReboot()} className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl border-2 border-rose-100 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-md group">
              <i className="fas fa-power-off text-lg group-hover:rotate-90 transition-transform"></i>
           </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-16">
        {/* MIGRATION STATUS PANEL */}
        {isAdmin && (
           <section className="space-y-8 animate-in">
              <div className="flex items-center gap-4 px-4">
                 <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                 <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">Cloud Migration Status</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <ActionTile to="/admin?tab=cloud" icon="fas fa-server" label="Verify Cloud Bridge" sub={`Currently Routing to: ${PERMANENT_CONFIG.email}`} color="bg-blue-600" highlight />
                 <div className={`transition-all duration-700 ${isBridgeReady ? 'bg-emerald-50 border-emerald-500' : 'bg-blue-50 border-blue-200'} border-4 border-dashed rounded-[2.5rem] p-8 flex items-center gap-6`}>
                    <div className={`w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border ${isBridgeReady ? 'text-emerald-600 border-emerald-100' : 'text-blue-600 border-blue-100'}`}>
                      <i className={`fas ${isBridgeReady ? 'fa-check-double animate-bounce' : 'fa-shield-check'} text-2xl`}></i>
                    </div>
                    <div>
                       <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isBridgeReady ? 'text-emerald-800' : 'text-blue-800'}`}>
                         {isBridgeReady ? 'NODE FULLY OPERATIONAL' : 'MIGRATION COMMITTED'}
                       </p>
                       <p className={`text-[11px] font-bold uppercase leading-relaxed ${isBridgeReady ? 'text-emerald-700' : 'text-blue-700'}`}>
                         {isBridgeReady ? 'Database is verified and responding to packets. seedsexamcell2024 is the active master vault.' : 'The internal engine is now sending all academic data to seedsexamcell2024@gmail.com.'}
                       </p>
                    </div>
                 </div>
              </div>
           </section>
        )}

        {/* DAILY OPERATIONS SECTION */}
        <section className="space-y-8">
           <div className="flex items-center gap-4 px-4">
              <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
              <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">Daily Academic Operations</h2>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-8">
             <ActionTile to="/attendance-register" icon="fas fa-calendar-check" label="Attendance Register" sub="Forensic Daily Presence" color="bg-emerald-600" />
             <ActionTile to="/marks" icon="fas fa-file-invoice" label="Academic Ledger" sub="Marks, Sum & Percentages" color="bg-amber-500" />
             <ActionTile to="/report-cards" icon="fas fa-graduation-cap" label="Transcripts Hub" sub="Official Term Reports" color="bg-purple-600" />
             <ActionTile to="/search" icon="fab fa-whatsapp" label="Absence Alerts" sub="WhatsApp Parent Gateway" color="bg-green-500" />
           </div>
        </section>

        {/* INFRASTRUCTURE SETUP SECTION */}
        <section className="space-y-8">
           <div className="flex items-center gap-4 px-4">
              <div className="w-2 h-8 bg-slate-900 rounded-full"></div>
              <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">Infrastructure & Data Entry</h2>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-8">
             <ActionTile to="/students" icon="fas fa-user-plus" label="Enroll Students" sub="Personnel Identity Entry" color="bg-blue-600" />
             <ActionTile to="/teachers" icon="fas fa-chalkboard-teacher" label="Faculty Registry" sub="Authorized Staff Nodes" color="bg-indigo-600" />
             <ActionTile to="/classes" icon="fas fa-layer-group" label="Grade Clusters" sub="Add & Manage Classes" color="bg-rose-600" />
             <ActionTile to="/subjects" icon="fas fa-book" label="Module Registry" sub="Curriculum Subjects" color="bg-teal-600" />
             <ActionTile to="/enquiry" icon="fas fa-search" label="Registry Scan" sub="Deep Identity Lookup" color="bg-slate-700" dark />
             <ActionTile to="/faculty-registry" icon="fas fa-clipboard-list" label="Faculty Audit" sub="Full Staff Roster" color="bg-slate-700" dark />
             <ActionTile to="/admin" icon="fas fa-shield-alt" label="Vault Branding" sub="Logo & Institution Identity" color="bg-slate-700" dark />
             <ActionTile to="/credits" icon="fas fa-microchip" label="System Credits" sub="Architectural Registry" color="bg-slate-700" dark />
           </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
