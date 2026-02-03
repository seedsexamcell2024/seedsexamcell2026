
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Student, ClassLevel, Teacher } from '../types.ts';
import { loadData, getActiveSessionYear, getActiveTerm } from '../services/dbService.ts';
import { VDB } from '../services/virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

const AttendancePreview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const activeYear = getActiveSessionYear();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  
  const [selectedGradeId, setSelectedGradeId] = useState(queryParams.get('gradeId') || '');
  const [selectedMonth, setSelectedMonth] = useState(queryParams.get('month') || 'January');
  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const fetchData = useCallback(async (force: boolean = false) => {
    await Promise.all([
        loadData('classes', force),
        loadData('students', force),
        loadData('teachers', force),
        loadData('attendance', force)
    ]);
    setClasses(VDB.queryAll('classes'));
    setStudents(VDB.queryAll('students'));
    setTeachers(VDB.queryAll('teachers'));
    setDataVersion(v => v + 1);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const reportDetails = useMemo(() => {
    if (!selectedGradeId) return null;
    const classObj = classes.find(c => VDB.normalize(c.id) === VDB.normalize(selectedGradeId));
    const teacherObj = teachers.find(t => t.classTeacherOf?.includes(selectedGradeId));
    const classStudents = students.filter(s => VDB.normalize(s.gradeId) === VDB.normalize(selectedGradeId)).sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0));
    
    const mIdx = monthsList.indexOf(selectedMonth);
    const sessionYearNum = parseInt(activeYear);
    
    // CANONICAL LOCK
    const actualYear = (mIdx >= 0 && mIdx <= 5) ? sessionYearNum + 1 : sessionYearNum;
    const daysInMonth = new Date(actualYear, mIdx + 1, 0).getDate();

    const studentDailyStats = classStudents.map(s => {
      const daily: { day: number, status: string, isWeekend: boolean, isHoliday: boolean }[] = [];
      let presentCount = 0, absentCount = 0, totalWorkingDays = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${actualYear}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isWeekend = VDB.isWeekend(dateStr);
        const status = VDB.getAttendanceStatus(s.id, dateStr);
        daily.push({ day: d, status: isWeekend ? '-' : status, isWeekend, isHoliday: status === 'H' });
        if (!isWeekend && status !== 'H') {
          totalWorkingDays++;
          if (status === 'P') presentCount++; else if (status === 'A') absentCount++;
        }
      }
      return { ...s, daily, presentCount, absentCount, percentage: totalWorkingDays > 0 ? Math.round((presentCount / totalWorkingDays) * 100) : 0 };
    });

    return { className: classObj?.name || 'N/A', teacherName: teacherObj?.name || 'Unassigned', session: activeYear, month: selectedMonth, daysInMonth, stats: studentDailyStats };
  }, [classes, teachers, students, selectedGradeId, selectedMonth, activeYear, dataVersion]);

  const logo = localStorage.getItem('schoolLogo') || PERMANENT_CONFIG.monogram;

  return (
    <div className="min-h-screen bg-white font-sans p-2 md:p-6 print:p-0">
      <div className="max-w-[1400px] mx-auto space-y-4 print:hidden">
        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
           <button onClick={() => navigate('/attendance-register')} className="px-6 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all"><i className="fas fa-arrow-left mr-2"></i> Return</button>
           <button onClick={() => window.print()} className="px-8 py-2 bg-black text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all"><i className="fas fa-print mr-2"></i> Print Report</button>
        </div>
      </div>

      {reportDetails && (
        <div className="mt-6 border-[3px] border-black p-2 md:p-6 mx-auto w-full bg-white">
           <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-4">
              <div className="flex items-center gap-4">
                 <img src={logo} className="w-12 h-12 md:w-16 md:h-16 object-contain" alt="Logo" />
                 <div>
                    <h1 className="text-lg md:text-2xl font-black uppercase text-black leading-none">{PERMANENT_CONFIG.name}</h1>
                    <p className="text-[7px] md:text-[10px] font-black text-black uppercase tracking-[0.3em] mt-1">Attendance Transcript • Session {reportDetails.session}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[8px] md:text-[10px] font-black text-black uppercase">{reportDetails.month} {reportDetails.session}</p>
                 <span className="text-[6px] md:text-[8px] font-bold text-slate-500 uppercase">Authorized Record</span>
              </div>
           </div>
           <div className="grid grid-cols-4 border-2 border-black mb-4 divide-x-2 divide-black text-center bg-slate-50 text-[8px] md:text-[10px] font-black uppercase">
              <div className="p-2"><p className="text-[6px] text-slate-500">GRADE</p>{reportDetails.className}</div>
              <div className="p-2"><p className="text-[6px] text-slate-500">TEACHER</p>{reportDetails.teacherName}</div>
              <div className="p-2"><p className="text-[6px] text-slate-500">PERIOD</p>{reportDetails.month}</div>
              <div className="p-2"><p className="text-[6px] text-slate-500">DAYS</p>{reportDetails.daysInMonth}</div>
           </div>
           <div className="w-full border-2 border-black overflow-hidden overflow-x-auto">
              <table className="w-full border-collapse table-fixed text-black text-[7px] md:text-[8px] font-black uppercase">
                <thead>
                  <tr className="bg-black text-white h-8">
                    <th className="border-r border-slate-700 w-10">S#</th>
                    <th className="border-r border-slate-700 w-40 text-left px-1">CANDIDATE</th>
                    {Array.from({ length: reportDetails.daysInMonth }).map((_, i) => (
                      <th key={i} className={`border-r border-slate-700 text-center ${reportDetails.stats[0]?.daily[i].isWeekend ? 'bg-zinc-800' : ''}`}>{i + 1}</th>
                    ))}
                    <th className="border-r border-slate-700 w-10 bg-zinc-900">P</th>
                    <th className="border-r border-slate-700 w-10 bg-zinc-900">A</th>
                    <th className="w-12 bg-zinc-900">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {reportDetails.stats.map((s, idx) => (
                    <tr key={s.id} className="h-6 md:h-7 hover:bg-slate-50">
                      <td className="border-r border-black text-center">{idx + 1}</td>
                      <td className="px-1 border-r border-black truncate text-left">{s.name}</td>
                      {s.daily.map((day, dIdx) => (
                        <td key={dIdx} className={`border-r border-black text-center ${day.isWeekend ? 'bg-slate-100' : (day.isHoliday ? 'bg-amber-50' : '')}`}>
                          {day.status === '-' ? '' : day.status}
                        </td>
                      ))}
                      <td className="border-r border-black text-center bg-slate-50">{s.presentCount}</td>
                      <td className="border-r border-black text-center bg-slate-50">{s.absentCount}</td>
                      <td className="text-center bg-slate-50">{s.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePreview;
