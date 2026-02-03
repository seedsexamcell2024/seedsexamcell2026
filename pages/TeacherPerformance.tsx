
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Teacher, Subject, Mark, ClassLevel, TestType } from '../types.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { loadData, getActiveSessionYear } from '../services/dbService.ts';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from 'recharts';

const TeacherPerformance = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter States
  const [selectedYear, setSelectedYear] = useState(getActiveSessionYear());
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('ALL');
  const [selectedTerm, setSelectedTerm] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  
  const [viewType, setViewType] = useState<'MONTHLY' | 'TERM'>('MONTHLY');

  const availableYears = Array.from({ length: 5 }, (_, i) => String(2024 + i));
  const monthsList = ['September', 'October', 'November', 'February', 'March', 'April'];

  const fetchData = useCallback(async (force: boolean = false) => {
    setIsLoading(true);
    try {
      // Fix: Simplified loadData calls to match Unified Vault Protocol signature (2 arguments max)
      await Promise.all([
        loadData('teachers', force),
        loadData('subjects', force),
        loadData('classes', force),
        loadData('marks', force)
      ]);
      setTeachers(VDB.queryAll('teachers'));
      setSubjects(VDB.queryAll('subjects'));
      setClasses(VDB.queryAll('classes'));
      setMarks(VDB.queryAll('marks'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive subjects available for the selected teacher
  const teacherSubjects = useMemo(() => {
    if (!selectedTeacherId) return [];
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) return [];
    const assignedIds = teacher.assignedSubjectIds || [];
    return subjects.filter(s => assignedIds.includes(s.id));
  }, [selectedTeacherId, teachers, subjects]);

  // Performance Calculation Logic
  const performanceData = useMemo(() => {
    if (!selectedTeacherId) return [];

    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) return [];

    const assignedIds = teacher.assignedSubjectIds || [];
    
    // Filter master marks list based on selection
    const filteredMarks = marks.filter(m => {
      const isTeacherSubject = assignedIds.includes(m.subjectId);
      const isSelectedSubject = selectedSubjectId === 'ALL' || m.subjectId === selectedSubjectId;
      const isSelectedYear = String(m.yearId) === selectedYear;
      const isSelectedTerm = selectedTerm === 'ALL' || m.term === selectedTerm;
      const isSelectedMonth = selectedMonth === 'ALL' || String(m.month).toLowerCase() === selectedMonth.toLowerCase();
      
      return isTeacherSubject && isSelectedSubject && isSelectedYear && isSelectedTerm && isSelectedMonth;
    });

    if (selectedMonth !== 'ALL') {
      // If a month is selected, show performance by SUBJECT
      return teacherSubjects
        .filter(s => selectedSubjectId === 'ALL' || s.id === selectedSubjectId)
        .map(sub => {
          const subMarks = filteredMarks.filter(m => m.subjectId === sub.id);
          const sum = subMarks.reduce((acc, m) => acc + (parseFloat(String(m.marksObtained)) || 0), 0);
          const totalMax = subMarks.length * (subMarks[0]?.totalMarks || 20);
          const avg = subMarks.length > 0 ? (sum / totalMax) * 100 : 0;
          return {
            label: sub.name.toUpperCase(),
            percentage: Number(avg.toFixed(1)),
            count: subMarks.length
          };
        }).filter(d => d.count > 0);
    }

    if (viewType === 'MONTHLY') {
      return monthsList.map(month => {
        const monthMarks = filteredMarks.filter(m => m.testType === TestType.MONTHLY && String(m.month).toLowerCase() === month.toLowerCase());
        const sum = monthMarks.reduce((acc, m) => acc + (parseFloat(String(m.marksObtained)) || 0), 0);
        const totalMax = monthMarks.length * 20; // Standard 20 marks for monthly
        const avg = monthMarks.length > 0 ? (sum / totalMax) * 100 : 0;
        return {
          label: month.substring(0, 3).toUpperCase(),
          percentage: Number(avg.toFixed(1)),
          count: monthMarks.length
        };
      });
    } else {
      const terms = ['1st', '2nd'];
      return terms.map(term => {
        const termMarks = filteredMarks.filter(m => m.testType === TestType.EXAM && m.term === term);
        const sum = termMarks.reduce((acc, m) => acc + (parseFloat(String(m.marksObtained)) || 0), 0);
        const totalMax = termMarks.length * 100; // Standard 100 marks for exams
        const avg = termMarks.length > 0 ? (sum / totalMax) * 100 : 0;
        return {
          label: `${term} TERM`,
          percentage: Number(avg.toFixed(1)),
          count: termMarks.length
        };
      });
    }
  }, [selectedTeacherId, selectedSubjectId, selectedYear, selectedTerm, selectedMonth, viewType, marks, teachers, teacherSubjects]);

  const COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#064e3b', '#022c22'];

  return (
    <div className="space-y-8 animate-in">
      {/* ELITE FILTER CONSOLE */}
      <div className="bg-white p-8 rounded-[3rem] border-2 border-black shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* SESSION */}
          <div className="space-y-2">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Session</label>
            <select 
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-black"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
            >
              {availableYears.map(y => <option key={y} value={y}>Session {y}</option>)}
            </select>
          </div>

          {/* TEACHER */}
          <div className="space-y-2">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Faculty Member</label>
            <select 
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-black"
              value={selectedTeacherId}
              onChange={e => { setSelectedTeacherId(e.target.value); setSelectedSubjectId('ALL'); }}
            >
              <option value="">Choose Faculty</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* SUBJECT */}
          <div className="space-y-2">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Module Subject</label>
            <select 
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-black disabled:opacity-30"
              value={selectedSubjectId}
              disabled={!selectedTeacherId}
              onChange={e => setSelectedSubjectId(e.target.value)}
            >
              <option value="ALL">All Subjects</option>
              {teacherSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({classes.find(c => c.id === s.gradeId)?.name})</option>)}
            </select>
          </div>

          {/* TERM */}
          <div className="space-y-2">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Term</label>
            <select 
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-black"
              value={selectedTerm}
              onChange={e => { setSelectedTerm(e.target.value); if (e.target.value === '1st') setSelectedMonth('September'); else if (e.target.value === '2nd') setSelectedMonth('February'); }}
            >
              <option value="ALL">All Terms</option>
              <option value="1st">1st Term</option>
              <option value="2nd">2nd Term</option>
            </select>
          </div>

          {/* MONTH */}
          <div className="space-y-2">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Audit Month</label>
            <select 
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-black"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              <option value="ALL">Full Period</option>
              {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-6 border-t border-slate-100 gap-4">
           <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
             <button 
               onClick={() => setViewType('MONTHLY')} 
               className={`px-8 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${viewType === 'MONTHLY' ? 'bg-black text-white shadow-lg' : 'text-slate-400'}`}
             >
               Monthly Trend
             </button>
             <button 
               onClick={() => setViewType('TERM')} 
               className={`px-8 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${viewType === 'TERM' ? 'bg-black text-white shadow-lg' : 'text-slate-400'}`}
             >
               Term Comparison
             </button>
           </div>
           <button onClick={() => fetchData(true)} className="flex items-center gap-3 px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all">
             <i className={`fas fa-sync-alt ${isLoading ? 'animate-spin' : ''}`}></i>
             Forensic Registry Audit
           </button>
        </div>
      </div>

      {selectedTeacherId ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ANALYTICS CHART */}
          <div className="lg:col-span-2 bg-white p-10 rounded-[4rem] border-2 border-black shadow-2xl space-y-8">
             <div className="flex justify-between items-center">
                <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Academic Velocity</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     {selectedMonth !== 'ALL' ? `Subject Variance: ${selectedMonth}` : `Instructional Impact Trend: ${selectedYear}`}
                   </p>
                </div>
                <div className="bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100 text-center">
                   <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">AGGREGATE MEAN</p>
                   <span className="text-xl font-black text-emerald-700 leading-none">
                     {Math.round(performanceData.reduce((acc, d) => acc + d.percentage, 0) / (performanceData.filter(d => d.count > 0).length || 1))}%
                   </span>
                </div>
             </div>

             <div className="h-[450px] w-full mt-6">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={performanceData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="label" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 9, fontWeight: 900 }}
                        dy={10}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                        unit="%"
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ 
                          borderRadius: '24px', 
                          border: '2px solid black', 
                          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)',
                          padding: '16px 24px',
                          textTransform: 'uppercase',
                          fontWeight: 900,
                          fontSize: '10px'
                        }}
                      />
                      <Bar dataKey="percentage" radius={[12, 12, 0, 0]} barSize={selectedMonth !== 'ALL' ? 60 : 45}>
                         {performanceData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                         ))}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* TABULAR INSIGHTS */}
          <div className="space-y-6">
             <div className="bg-slate-950 p-8 rounded-[3rem] text-white shadow-xl">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-6">Instructional Matrix</p>
                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                   {teacherSubjects.map(s => (
                     <div key={s.id} className={`flex justify-between items-center border-b border-white/10 pb-3 transition-opacity ${selectedSubjectId !== 'ALL' && selectedSubjectId !== s.id ? 'opacity-30' : 'opacity-100'}`}>
                        <div>
                           <p className="text-[11px] font-black uppercase tracking-tight">{s.name}</p>
                           <p className="text-[8px] font-bold text-white/40 uppercase">{classes.find(c => c.id === s.gradeId)?.name}</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                     </div>
                   ))}
                </div>
             </div>

             <div className="bg-white p-8 rounded-[3rem] border-2 border-black shadow-sm">
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-6">Performance Registry</p>
                <div className="space-y-3">
                   {performanceData.length > 0 ? performanceData.map((d, i) => (
                     <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex-1 min-w-0 mr-4">
                           <p className="text-[10px] font-black text-slate-900 uppercase truncate">{d.label}</p>
                           <p className="text-[8px] font-bold text-slate-400 uppercase">{d.count} GRADED RECORDS</p>
                        </div>
                        <div className="text-right">
                           <p className="text-lg font-black text-slate-900 leading-none">{d.percentage}%</p>
                           <div className="w-16 h-1.5 bg-slate-200 mt-2 rounded-full overflow-hidden border border-slate-300">
                              <div className="h-full bg-emerald-500" style={{ width: `${d.percentage}%` }}></div>
                           </div>
                        </div>
                     </div>
                   )) : (
                     <div className="py-10 text-center text-slate-400 italic text-[10px]">No valid grading data found for this selection cluster.</div>
                   )}
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="py-40 text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-200">
           <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-slate-300 shadow-inner">
              <i className="fas fa-chart-line text-4xl"></i>
           </div>
           <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Faculty Performance Hub</h4>
           <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] max-w-sm mx-auto leading-relaxed">
             Select a faculty member from the filter console to initialize performance visualization and academic audit metrics.
           </p>
        </div>
      )}
    </div>
  );
};

export default TeacherPerformance;
