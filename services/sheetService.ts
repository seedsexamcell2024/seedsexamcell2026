
/**
 * SEEDS CLAY RELAY SERVICE v22.0
 * Protocol: Bulletproof Connectivity with Timeouts
 */

import { getCloudUrl } from '../config.ts';

const MASTER_SCHEMA: Record<string, string[]> = {
  "attendance": ["id", "yearId", "termId", "studentId", "date", "status"],
  "students": ["id", "yearId", "termId", "serialNumber", "name", "rollNumber", "gradeId", "parentName", "parentPhone", "enrolledSubjects", "dateOfAdmission"],
  "marks": ["id", "yearId", "termId", "studentId", "subjectId", "testType", "month", "marksObtained", "totalMarks", "term", "teacherId"],
  "classes": ["id", "serialNumber", "name", "yearId", "termId"],
  "teachers": ["id", "serialNumber", "name", "phone", "role", "assignedGradeIds", "assignedSubjectIds", "classTeacherOf"],
  "subjects": ["id", "serialNumber", "name", "gradeId", "yearId", "termId"],
  "marksheets": ["id", "yearId", "termId", "gradeId", "subjectId", "teacherId", "dateCreated", "status"],
  "identity": ["id", "yearId", "termId", "schoolName", "schoolLogo", "developerPhoto", "isLocked"],
  "timetables": ["id", "yearId", "termId", "gradeId", "day", "periodIndex", "subjectId", "teacherId"]
};

/**
 * Utility: Fetch with timeout
 */
const fetchWithTimeout = async (url: string, options: any = {}, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(id);
  return response;
};

/**
 * Pushes data to the Google Sheet.
 */
export const cloudPush = async (
  storeName: string, 
  year: string, 
  term: string, 
  data: any[], 
  month?: number, 
  gradeName?: string,
  teacherName?: string
): Promise<boolean> => {
  if (!navigator.onLine) return false;
  
  const url = getCloudUrl();
  if (!url) return false;

  const allowedFields = MASTER_SCHEMA[storeName.toLowerCase()];
  if (!allowedFields) return false;

  const sanitizedData = data.map(item => {
    const clean: any = {};
    allowedFields.forEach(field => {
      if (field === 'yearId') clean[field] = year;
      else if (field === 'termId') clean[field] = term;
      else {
        let val = item[field];
        if ((field === 'date' || field === 'dateOfAdmission' || field === 'dateCreated') && typeof val === 'string' && val.includes('T')) {
          val = val.split('T')[0];
        }
        clean[field] = (val === undefined || val === null) ? "" : val;
      }
    });
    return clean;
  });

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        store: storeName.toUpperCase(),
        year: year,
        term: term,
        month: month || null,
        metadata: {
          grade: gradeName || 'N/A',
          teacher: teacherName || 'N/A',
          timestamp: new Date().toISOString()
        },
        data: sanitizedData
      })
    }, 8000); // 8s for push
    
    return response.ok; 
  } catch (e) {
    return false;
  }
};

/**
 * Pulls data from the Google Sheet.
 */
export const cloudPull = async (storeName: string, year: string, term: string): Promise<any[] | null> => {
  if (!navigator.onLine) return null;

  const baseUrl = getCloudUrl();
  if (!baseUrl) return null;

  const url = `${baseUrl}?year=${year}&term=${term}&store=${storeName.toUpperCase()}&ts=${Date.now()}`;

  try {
    const response = await fetchWithTimeout(url, { method: 'GET', redirect: 'follow', mode: 'cors' }, 5000);
    if (!response.ok) return null;
    const result = await response.json();
    if (result && result.status === 'SUCCESS' && Array.isArray(result.data)) {
        return result.data.map((item: any) => {
           const clean: any = {};
           Object.keys(item).forEach(k => {
             if (!k.startsWith('Column ')) clean[k] = item[k];
           });
           return clean;
        });
    }
    return [];
  } catch (e) {
    return null;
  }
};

/**
 * Validates the connectivity.
 */
export const testCloudConnection = async (testUrl: string): Promise<{ok: boolean, msg: string}> => {
  if (!navigator.onLine) return { ok: false, msg: "NO INTERNET" };
  if (!testUrl || !testUrl.startsWith('https://script.google.com')) {
    return { ok: false, msg: "INVALID URL" };
  }
  const cleanUrl = testUrl.trim().split('?')[0];
  try {
    const response = await fetchWithTimeout(`${cleanUrl}?test=1&ts=${Date.now()}`, { method: 'GET', mode: 'cors', redirect: 'follow' }, 5000);
    const result = await response.json();
    if (result && (result.status === 'SUCCESS' || result.status === 'READY')) {
      return { ok: true, msg: "BRIDGE READY" };
    }
    return { ok: false, msg: "INVALID RESPONSE" };
  } catch (e: any) {
    return { ok: false, msg: "CONNECTION FAILED" };
  }
};
