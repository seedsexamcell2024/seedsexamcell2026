
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext.tsx';
import { PERMANENT_CONFIG } from '../config.ts';

const Credits = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  return (
    <div className="space-y-8 animate-in pb-20 p-4 lg:p-10 bg-[#f8fafc] min-h-screen">
      <button onClick={() => navigate('/')} className="group flex items-center gap-3 px-6 py-2.5 bg-white border border-slate-200 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:bg-black hover:text-white transition-all print:hidden">
        <i className="fas fa-chevron-left group-hover:-translate-x-1 transition-transform text-[10px]"></i> BACK TO DASHBOARD
      </button>

      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-8 lg:p-16 rounded-[3rem] border border-slate-200 shadow-2xl relative overflow-hidden text-center">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-[60px] pointer-events-none"></div>
          
          <div className="relative z-10 space-y-8">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-950 text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Principal Systems Architect
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-7xl font-black text-slate-900 uppercase tracking-tighter leading-[0.85]">
                Mr. A. <span className="text-emerald-600 italic">Rasheed</span>
              </h1>
              <div className="h-1.5 w-24 bg-emerald-600 rounded-full mx-auto"></div>
            </div>

            <p className="text-slate-500 font-medium text-base lg:text-lg max-w-2xl mx-auto leading-relaxed">
              Orchestrating the development of <span className="text-slate-900 font-bold">Autonomous Educational Ecosystems</span> and high-precision academic engines. Dedicated to institutional excellence through absolute digital sovereignty and local-first architecture.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 max-w-2xl mx-auto">
              <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-[2rem] border border-slate-100 shadow-sm group hover:bg-emerald-50 transition-colors text-left">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                  <i className="fas fa-envelope text-sm"></i>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Digital Mail</span>
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">rasheedpsh2023@gmail.com</span>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-[2rem] border border-slate-100 shadow-sm group hover:bg-emerald-50 transition-colors text-left">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                  <i className="fas fa-phone text-sm"></i>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Direct Line</span>
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">0333 9849098</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
         <TechNode icon="fab fa-react" label="React 19" sub="Neural Core" color="text-blue-500" />
         <TechNode icon="fas fa-brain" label="Gemini AI" sub="Cognitive Logic" color="text-emerald-500" />
         <TechNode icon="fas fa-cloud-bolt" label="Cloud Sync" sub="Global Mirror" color="text-amber-500" />
         <TechNode icon="fas fa-shield-halved" label="Vault Guard" sub="Secure Ledger" color="text-slate-900" />
      </div>

      <div className="text-center pt-12">
         <div className="inline-block px-8 py-3 rounded-full border border-slate-200 bg-white shadow-sm">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.5em] opacity-80">
              ENGINEERED BY THE RASHEED STRATEGIC LAB • KP, PAKISTAN
           </p>
         </div>
      </div>
    </div>
  );
};

const TechNode = ({ icon, label, sub, color }: { icon: string, label: string, sub: string, color: string }) => (
  <div className="bg-white p-6 lg:p-8 rounded-[2rem] border border-slate-200 hover:border-emerald-500 hover:shadow-xl transition-all duration-500 text-center group cursor-default">
     <div className={`w-12 h-12 rounded-xl bg-slate-50 ${color} flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100 group-hover:scale-110 group-hover:rotate-3 transition-all`}>
        <i className={`${icon} text-xl`}></i>
     </div>
     <h4 className="text-slate-900 font-black uppercase text-[11px] tracking-tight mb-0.5">{label}</h4>
     <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{sub}</p>
  </div>
);

export default Credits;
