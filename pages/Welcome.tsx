
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERMANENT_CONFIG } from '../config.ts';

const Welcome = () => {
  const navigate = useNavigate();
  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  useEffect(() => {
    const timer = setTimeout(() => navigate('/'), 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      {/* PERFORMANCE GRADIENT BACKGROUND */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-emerald-950/20 to-slate-950"></div>

      {/* CONTENT LAYER */}
      <div className="relative z-10 max-w-5xl space-y-10 animate-in">
        <div className="w-20 h-20 bg-white rounded-3xl p-4 mx-auto shadow-2xl border border-white/10">
          <img src={logo} className="w-full h-full object-contain" alt="SEEDS" />
        </div>

        <div className="space-y-6">
          <p className="text-emerald-400 font-black text-[9px] uppercase tracking-[0.6em] opacity-80">
            Authorization Confirmed
          </p>
          
          <h1 className="text-3xl md:text-5xl font-black uppercase leading-tight text-white tracking-widest">
            SEEDS SCHOOL OF EXCELLENCE
          </h1>

          <div className="flex justify-center pt-8">
             <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                ))}
             </div>
          </div>
        </div>
      </div>

      <style>{`
        .animate-in {
          animation: slideUp 0.6s ease-out forwards;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Welcome;
