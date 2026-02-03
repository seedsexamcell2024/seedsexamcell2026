
import React, { createContext, useContext } from 'react';
import { ThemeConfig } from '../types';

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#000000',
  secondaryColor: '#334155',
  headingColor: '#000000',
  backgroundColor: '#f8fafc',
  cardColor: '#ffffff',
  textColor: '#000000',
  buttonTextColor: '#ffffff',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  baseFontSize: 12,
  headingFontSize: 14,
  schoolName: 'SEEDS School of Excellence',
  schoolAddress: 'School Of Excellence in Education and Development Studies',
  titles: {
    dashboard: 'Dashboard',
    students: 'Enter New Student',
    teachers: 'Faculty Records',
    subjects: 'Manage Curriculum',
    marks: 'COURSEWORK ASSESSMENT RECORD',
    attendance: 'ATTENDANCE REGISTER',
    search: 'DAILY ABSENT STUDENTS TRACKER',
    reports: 'TERM-REPORT CARD',
    admin: 'Admin Panel'
  }
};

export const ThemeContext = createContext<{
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
}>({
  theme: DEFAULT_THEME,
  setTheme: () => {}
});

export const useTheme = () => useContext(ThemeContext);
