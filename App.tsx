
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ThemeContext, DEFAULT_THEME } from './contexts/ThemeContext.tsx';
import StaffLogin from './pages/StaffLogin.tsx';

// CORE MODULES
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const Admin = lazy(() => import('./pages/Admin.tsx'));
const Welcome = lazy(() => import('./pages/Welcome.tsx'));
const Credits = lazy(() => import('./pages/Credits.tsx'));

// REGISTRY MODULES
const Students = lazy(() => import('./pages/Students.tsx'));
const Teachers = lazy(() => import('./pages/Teachers.tsx'));
const Subjects = lazy(() => import('./pages/Subjects.tsx'));
const Classes = lazy(() => import('./pages/Classes.tsx'));
const StudentEnquiry = lazy(() => import('./pages/StudentEnquiry.tsx'));
const FacultyRegistry = lazy(() => import('./pages/FacultyRegistry.tsx'));

// ACADEMIC MODULES
const Marks = lazy(() => import('./pages/Marks.tsx'));
const SubjectwiseReport = lazy(() => import('./pages/SubjectwiseReport.tsx'));
const Timetable = lazy(() => import('./pages/Timetable.tsx'));

// ATTENDANCE MODULES
const Attendance = lazy(() => import('./pages/Attendance.tsx'));
const AttendanceRegister = lazy(() => import('./pages/AttendanceRegister.tsx'));

// REPORTING MODULES
const ReportCards = lazy(() => import('./pages/ReportCards.tsx'));
const MonthlyReports = lazy(() => import('./pages/MonthlyReports.tsx'));
const SearchReports = lazy(() => import('./pages/SearchReports.tsx'));

/**
 * SEEDS INSTITUTIONAL SHELL v27.0
 * DESIGNED BY: MR. A. RASHEED
 */
const UniversalNavigation = () => {
  const location = useLocation();
  const hiddenPaths = ['/', '/login', '/welcome'];
  if (hiddenPaths.includes(location.pathname)) return null;

  return (
    <div className="fixed bottom-8 right-6 md:bottom-12 md:right-12 z-[9999] group print:hidden">
      <Link 
        to="/" 
        className="w-16 h-16 md:w-20 md:h-20 bg-slate-950 rounded-[2rem] flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-2 border-white/10 hover:scale-110 active:scale-95 transition-all group"
      >
        <i className="fas fa-home text-xl md:text-2xl text-white"></i>
      </Link>
    </div>
  );
};

const LoadingSkeleton = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_#10b981]"></div>
        <p className="mt-8 text-[10px] font-black text-white uppercase tracking-[0.6em] animate-pulse">Decrypting Vault...</p>
    </div>
);

const AppContent = () => {
  const [userRole, setUserRole] = useState<string | null>(localStorage.getItem('session_role'));
  
  useEffect(() => {
    const handleLogin = () => setUserRole(localStorage.getItem('session_role'));
    const handleLogout = () => setUserRole(null);
    window.addEventListener('LOGIN_SUCCESS', handleLogin);
    window.addEventListener('LOGOUT_SUCCESS', handleLogout);
    return () => {
      window.removeEventListener('LOGIN_SUCCESS', handleLogin);
      window.removeEventListener('LOGOUT_SUCCESS', handleLogout);
    };
  }, []);

  if (!userRole) return <StaffLogin />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <UniversalNavigation />
      <main className="w-full">
        <Suspense fallback={<LoadingSkeleton />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/credits" element={<Credits />} />
            <Route path="/students" element={<Students />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/enquiry" element={<StudentEnquiry />} />
            <Route path="/faculty-registry" element={<FacultyRegistry />} />
            <Route path="/marks" element={<Marks />} />
            <Route path="/subject-ledger" element={<SubjectwiseReport />} />
            <Route path="/timetable" element={<Timetable />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/attendance-register" element={<AttendanceRegister />} />
            <Route path="/report-cards" element={<ReportCards />} />
            <Route path="/monthly-reports" element={<MonthlyReports />} />
            <Route path="/search" element={<SearchReports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

const App = () => (
  <ThemeContext.Provider value={{ theme: DEFAULT_THEME, setTheme: () => {} }}>
    <HashRouter>
      <AppContent />
    </HashRouter>
  </ThemeContext.Provider>
);

export default App;
