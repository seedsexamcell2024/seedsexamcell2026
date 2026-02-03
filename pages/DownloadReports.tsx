
import React, { useState, useEffect, useMemo } from 'react';
import { Student, ClassLevel, Subject, Mark, Teacher, StoredReport } from '../types.ts';
import { loadData, getActiveSessionYear, getActiveTerm, saveData } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { generateStudentReportPDF } from '../services/pdfGenerator.ts';

const DownloadReports = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const activeYear = getActiveSessionYear();
  const activeTerm = getActiveTerm();

  const [mFilter, setMFilter] = useState({ year: activeYear, month: 'September', gradeId: '', term: activeTerm });
  const [tFilter, setTFilter] = useState({ year: activeYear, term: activeTerm, gradeId: '' });
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true);
      await Promise.allSettled([
        loadData('students'),
        loadData('classes'),
        loadData('subjects'),
        loadData('marks'),
        loadData('teachers')
      ]);
      setStudents(VDB.queryAll('students'));
      setClasses(VDB.queryAll('classes'));
      setSubjects(VDB.queryAll('subjects'));
      setMarks(VDB.queryAll('marks'));
      setTeachers(VDB.queryAll('teachers'));
      setIsLoading(false);
    };
    fetch();
  }, [activeYear]);

  // Clean up Blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const monthlyStudents = useMemo(() => {
    return students
      .filter(s => !mFilter.gradeId || s.gradeId === mFilter.gradeId)
      .sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0));
  }, [students, mFilter.gradeId]);

  const termStudents = useMemo(() => {
    return students
      .filter(s => !tFilter.gradeId || s.gradeId === tFilter.gradeId)
      .sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0));
  }, [students, tFilter.gradeId]);

  const handleGenerate = async (type: 'MONTHLY' | 'TERM', student: Student, action: 'DOWNLOAD' | 'PREVIEW') => {
    const filter = type === 'MONTHLY' ? mFilter : tFilter;
    
    setIsLoading(true);
    try {
      const pdfBytes = await generateStudentReportPDF(
        type,
        student,
        classes,
        subjects,
        marks,
        teachers,
        filter.year,
        type === 'MONTHLY' ? mFilter.month : undefined,
        filter.term
      );

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Convert to Base64 for permanent storage
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        const newReport: StoredReport = {
          id: `REP_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
          type,
          month: type === 'MONTHLY' ? mFilter.month : undefined,
          term: filter.term,
          year: filter.year,
          timestamp: new Date().toISOString(),
          pdfData: base64data,
          fileName: `${student.name.replace(/\s+/g, '_')}_${type}_${filter.year}.pdf`
        };

        const updatedStudents = students.map(s => {
          if (s.id === student.id) {
            const existing = s.reports || [];
            // Remove previous version of the same report if it exists
            const filtered = existing.filter(r => !(r.type === type && r.month === newReport.month && r.term === newReport.term && r.year === newReport.year));
            return { ...s, reports: [...filtered, newReport] };
          }
          return s;
        });

        setStudents(updatedStudents);
        await saveData('students', updatedStudents);
      };
      reader.readAsDataURL(blob);

      if (action === 'PREVIEW') {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${student.name}_${type}_${filter.year}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("PDF Generation Protocol Failed:", error);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-12 animate-in p-2 lg:p-6 pb-40">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        {/* MONTHLY BLOCK */}
        <div className="bg-white rounded-[3rem] border-2 border-black p-8 space-y-8 shadow-sm hover:shadow-2xl transition-all">
          <div className="flex items-center gap-6 border-b border-slate-100 pb-6">
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-[1.5rem] flex items-center justify-center text-2xl shadow-lg rotate-3 group-hover:rotate-0 transition-transform">
              <i className="fas fa-calendar-alt"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Monthly Reports Ledger</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">High-Precision Academic Performance Audit</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
             <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade Level</label>
                <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[9px] font-black uppercase outline-none focus:ring-4 focus:ring-emerald-500/5" value={mFilter.gradeId} onChange={e => setMFilter({...mFilter, gradeId: e.target.value})}>
                  <option value="">ALL CLUSTERS</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             </div>
             <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Calendar Month</label>
                <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[9px] font-black uppercase outline-none focus:ring-4 focus:ring-emerald-500/5" value={mFilter.month} onChange={e => setMFilter({...mFilter, month: e.target.value})}>
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
             </div>
             <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Term</label>
                <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[9px] font-black uppercase outline-none focus:ring-4 focus:ring-emerald-500/5" value={mFilter.term} onChange={e => setMFilter({...mFilter, term: e.target.value as any})}>
                  <option value="1st">1ST TERM</option>
                  <option value="2nd">2ND TERM</option>
                </select>
             </div>
             <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Session</label>
                <div className="bg-slate-950 text-white rounded-xl px-3 py-2 text-[9px] font-black uppercase flex items-center justify-center border border-slate-800 shadow-inner">
                   SESSION {activeYear}
                </div>
             </div>
          </div>

          <div className="h-[500px] overflow-y-auto custom-scrollbar pt-2 space-y-4 pr-2">
            {monthlyStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between p-5 bg-white border-2 border-slate-50 rounded-[2rem] hover:border-emerald-100 hover:bg-emerald-50/30 transition-all group shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center text-xl border border-rose-100 shadow-inner group-hover:scale-110 transition-transform">
                    <i className="fas fa-file-pdf"></i>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase text-slate-900 leading-none">{s.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-2 tracking-widest">{s.rollNumber} • {classes.find(c => c.id === s.gradeId)?.name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleGenerate('MONTHLY', s, 'PREVIEW')} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-950 hover:text-white transition-all shadow-sm">Preview</button>
                  <button onClick={() => handleGenerate('MONTHLY', s, 'DOWNLOAD')} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 active:scale-95 transition-all">Download</button>
                </div>
              </div>
            ))}
            {monthlyStudents.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                <i className="fas fa-search text-6xl mb-4"></i>
                <p className="text-xs font-black uppercase tracking-[0.4em]">No Candidates in selection</p>
              </div>
            )}
          </div>
        </div>

        {/* TERM BLOCK */}
        <div className="bg-white rounded-[3rem] border-2 border-black p-8 space-y-8 shadow-sm hover:shadow-2xl transition-all">
          <div className="flex items-center gap-6 border-b border-slate-100 pb-6">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center text-2xl shadow-lg -rotate-3 group-hover:rotate-0 transition-transform">
              <i className="fas fa-graduation-cap"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Term Reports Ledger</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Formal Terminal Academic Verification</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
             <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade Level</label>
                <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/5" value={tFilter.gradeId} onChange={e => setTFilter({...tFilter, gradeId: e.target.value})}>
                  <option value="">ALL CLUSTERS</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             </div>
             <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Term</label>
                <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/5" value={tFilter.term} onChange={e => setTFilter({...tFilter, term: e.target.value as any})}>
                  <option value="1st">1ST TERM</option>
                  <option value="2nd">2ND TERM</option>
                </select>
             </div>
             <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Session</label>
                <div className="bg-slate-950 text-white rounded-xl px-4 py-2.5 text-[10px] font-black uppercase flex items-center justify-center border border-slate-800 shadow-inner">
                   SESSION {activeYear}
                </div>
             </div>
          </div>

          <div className="h-[500px] overflow-y-auto custom-scrollbar pt-2 space-y-4 pr-2">
            {termStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between p-5 bg-white border-2 border-slate-50 rounded-[2rem] hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center text-xl border border-rose-100 shadow-inner group-hover:scale-110 transition-transform">
                    <i className="fas fa-file-pdf"></i>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase text-slate-900 leading-none">{s.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-2 tracking-widest">{s.rollNumber} • {classes.find(c => c.id === s.gradeId)?.name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleGenerate('TERM', s, 'PREVIEW')} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-950 hover:text-white transition-all shadow-sm">Preview</button>
                  <button onClick={() => handleGenerate('TERM', s, 'DOWNLOAD')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Download</button>
                </div>
              </div>
            ))}
            {termStudents.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                <i className="fas fa-search text-6xl mb-4"></i>
                <p className="text-xs font-black uppercase tracking-[0.4em]">No Candidates in selection</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF PREVIEW MODAL */}
      {previewUrl && (
        <div className="fixed inset-0 z-[10001] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[3rem] flex flex-col overflow-hidden border-t-[16px] border-emerald-600 shadow-2xl animate-in">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Institutional Document Preview</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Authorized Official Transcript View</p>
              </div>
              <button 
                onClick={() => { setPreviewUrl(null); }} 
                className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm group"
              >
                <i className="fas fa-times text-2xl group-hover:rotate-90 transition-transform"></i>
              </button>
            </div>
            <div className="flex-1 bg-slate-200 relative">
               <iframe src={previewUrl} className="w-full h-full border-none"></iframe>
               {isLoading && (
                 <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                       <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Rendering Ledger...</p>
                    </div>
                 </div>
               )}
            </div>
            <div className="p-8 bg-slate-50 border-t flex justify-center gap-4">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                  Document generated by SEEDS Core Engine v9.4 • Use desktop browser for optimal printing
               </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadReports;
