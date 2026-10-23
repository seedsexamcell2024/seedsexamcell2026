(() => {
  window.addEventListener('error', event => console.error('Global error:', event.error));
  window.addEventListener('unhandledrejection', event => console.error('Unhandled rejection:', event.reason));
  'use strict';

  const todayISO = () => {
    const date = new Date();
    return localDateISO(date);
  };
  const localDateISO = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  // Pakistan timezone (Asia/Karachi, UTC+5) — all date operations use this timezone
  // to ensure consistent date handling regardless of the user's browser timezone.
  const pakistanDateISO = (date, usePSTOffset = true) => {
    const d = new Date(date);
    const offset = usePSTOffset ? 5 * 60 : 0;
    d.setMinutes(d.getMinutes() + offset);
    return localDateISO(d);
  };
  const pakistanTodayISO = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5 * 60);
    return localDateISO(d);
  };
  const SCHOOL_NAME = 'SEEDS School of Excellence';
  const BRAND_LOGO = 'assets/seeds-logo.png';
  const config = window.SEEDS_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const supabaseAnonKey = String(config.supabaseAnonKey || '');
  const isConfigured = /^https:\/\/[^/]+\.supabase\.co$/.test(supabaseUrl) && supabaseAnonKey.length > 20;
  const state = {
    mode: 'unconfigured',
    token: '',
    user: null,
    profile: null,
    view: 'overview',
    search: '',
    classStrengthSearch: '',
    selectedLoginRole: 'developer',
    loginMode: 'signin',
    currentSchoolId: '',
    imageUrls: {},
    accounts: [],
    accountsLoaded: false,
    activeAssessment: null,
    assessmentAssignmentId: '',
    assessmentTerm: '1st Term',
    assessmentShowBothTerms: false,
    assessmentShowWholeClass: false,
    assessmentEnrollOpen: false,
    // Use Pakistan timezone (IST, UTC+5) for default dates
    attendanceDate: pakistanTodayISO(),
    attendanceClass: '',
    absenteeDate: pakistanTodayISO(),
    studentDirectoryClass: '',
    attendanceAssignmentId: '',
    attendanceRangeMode: false,
    attendanceRangeStart: pakistanTodayISO(),
    attendanceRangeEnd: pakistanTodayISO(),
    attendanceStatuses: {},
    attendanceViewMode: 'daily',
    attendanceMonth: pakistanTodayISO().slice(0, 7),
    attendancePrintOrientation: 'landscape',
    reportCardScope: 'monthly',
    reportCardTerm: '1st Term',
    reportCardMonth: '',
    reportCardStudentId: '',
    reportCardClass: '',
    data: Object.fromEntries([
      'schools', 'students', 'teachers', 'classes', 'subjects', 'class_subjects',
      'subject_enrollments', 'attendance', 'subject_attendance', 'assessments',
      'marks', 'parent_students', 'homework_diaries', 'homework_receipts', 'absentee_records'
    ].map(table => [table, []]))
  };

  const defaultDeveloperCredit = () => ({
    name: 'A. Rasheed',
    bio: 'A. Rasheed is a web developer with long and extensive experience in web development, building modern, reliable and user-friendly applications.',
    photo: '',
    links: []
  });
  const loadDeveloperCredit = () => {
    try {
      const raw = localStorage.getItem('developerCredit');
      if (!raw) return defaultDeveloperCredit();
      const parsed = JSON.parse(raw);
      return { ...defaultDeveloperCredit(), ...parsed, links: Array.isArray(parsed?.links) ? parsed.links : [] };
    } catch (error) {
      return defaultDeveloperCredit();
    }
  };
  state.developerCredit = loadDeveloperCredit();

  const $ = selector => document.querySelector(selector);
  const pageContent = $('#pageContent');
  const toast = $('#toast');
  let toastTimer;

  const labels = {
    overview: 'Overview',
    students: 'Students',
    teachers: 'Teachers',
    academics: 'Classes & subjects',
    attendance: 'Attendance',
    assessments: 'Assessments & marks',
    reports: 'Reports',
    reportcards: 'Report cards',
    accounts: 'User accounts',
    school: 'School settings',
    credit: 'Developer credit',
    homework: 'Homework diary',
    session: 'Session & promotion',
    branding: 'Branding & labels',
    reminders: 'Teacher reminders'
  };

  const roleNames = {
    developer: 'Developer',
    admin: 'Administrator',
    teacher: 'Teacher',
    student: 'Student',
    parent: 'Parent / guardian'
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const applyLabelOverrides = (root) => {
    try {
      const branding = window.SEEDS_BRANDING;
      if (!branding) return;
      const overrides = branding.get().labels || {};
      const entries = Object.keys(overrides)
        .filter(k => typeof overrides[k] === 'string' && overrides[k].trim() !== '')
        .sort((a, b) => b.length - a.length);
      if (!entries.length) return;
      const target = root || document;
      // text nodes
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        let text = node.nodeValue;
        let changed = false;
        entries.forEach(def => {
          const custom = overrides[def];
          if (text.indexOf(def) !== -1) {
            text = text.split(def).join(custom);
            changed = true;
          }
        });
        if (changed) node.nodeValue = text;
      });
      // placeholders
      target.querySelectorAll && target.querySelectorAll('[placeholder]').forEach(el => {
        let ph = el.getAttribute('placeholder');
        let changed = false;
        entries.forEach(def => {
          if (ph && ph.indexOf(def) !== -1) { ph = ph.split(def).join(overrides[def]); changed = true; }
        });
        if (changed) el.setAttribute('placeholder', ph);
      });
      // aria-label
      target.querySelectorAll && target.querySelectorAll('[aria-label]').forEach(el => {
        let al = el.getAttribute('aria-label');
        let changed = false;
        entries.forEach(def => {
          if (al && al.indexOf(def) !== -1) { al = al.split(def).join(overrides[def]); changed = true; }
        });
        if (changed) el.setAttribute('aria-label', al);
      });
    } catch (e) { /* ignore */ }
  };
  const applyBrandingFonts = () => { if (window.SEEDS_BRANDING) window.SEEDS_BRANDING.applyFonts(); };


  const showToast = (message, isError = false) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    if (isError) {
      console.error('TOAST ERROR:', message);
    }
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), isError ? 10000 : 3600);
  };

  const setLoginMessage = message => {
    $('#loginMessage').textContent = message;
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const records = table => state.data[table] || [];
  const isManager = () => ['developer', 'admin'].includes(state.profile?.role);
  const currentSchool = () => records('schools').find(school => school.id === state.currentSchoolId) || records('schools')[0] || {};
  const imageSrc = row => row?.photo_preview || state.imageUrls[row?.photo_path] || '';
  const className = id => records('classes').find(row => row.id === id)?.name || 'Unassigned';
  const subjectName = id => records('subjects').find(row => row.id === id)?.name || '—';
  const teacherName = id => records('teachers').find(row => row.id === id)?.full_name || 'Unassigned';
  const studentName = id => records('students').find(row => row.id === id)?.full_name || 'Unknown student';
  const assessmentName = id => records('assessments').find(row => row.id === id)?.title || 'Assessment';

  const pakistanTimeMinutes = () => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const hour = Number(parts.find(part => part.type === 'hour')?.value || '0');
    const minute = Number(parts.find(part => part.type === 'minute')?.value || '0');
    return hour * 60 + minute;
  };
  const pakistanDayName = date => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date(`${date}T12:00:00+05:00`));
  const normalizeName = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizeClassKey = value => String(value || '').trim().replace(/[\s-]/g, '').toLowerCase();
  const splitHomeworkSubjects = value => String(value || '').split(/[+,]/).map(part => part.trim()).filter(Boolean);
  const findClassByName = name => records('classes').find(row => normalizeClassKey(row.name) === normalizeClassKey(name));
  const findSubjectByName = name => records('subjects').find(row => normalizeName(row.name) === normalizeName(name));
  const HOMEWORK_SCHEDULE = {
    '4th': {
      Monday: ['Maths', 'English', 'Science', 'Urdu'],
      Tuesday: ['Urdu', 'Science', 'GK'],
      Wednesday: ['Islamiat', 'English', 'GK'],
      Thursday: ['Urdu', 'Science', 'Islamiat', 'GK'],
      Friday: ['Maths', 'Urdu', 'Science']
    },
    '7th': {
      Monday: ['Islamiat', 'English', 'Science', 'Urdu'],
      Tuesday: ['Urdu', 'Science', 'Maths', 'English'],
      Wednesday: ['Social Studies', 'English', 'Science', 'Maths'],
      Thursday: ['Urdu', 'Science', 'Islamiat', 'Social Studies'],
      Friday: ['Maths', 'Urdu', 'Science', 'Computer']
    },
    'O1': {
      Monday: ['Islamiat', 'English', 'Biology', 'Computer Science'],
      Tuesday: ['Urdu', 'Physics', 'Maths', 'Business Studies'],
      Wednesday: ['Pak Studies', 'English', 'Chemistry', 'Commerce + Maths'],
      Thursday: ['Urdu', 'Physics', 'Islamiat'],
      Friday: ['Maths', 'Pak Studies', 'Chemistry', 'Biology']
    },
    'O2': {
      Monday: ['Islamiat', 'English', 'Biology', 'Computer Science'],
      Tuesday: ['Pak Studies', 'English + Urdu', 'Chemistry', 'Business Studies'],
      Wednesday: ['Pak Studies', 'English', 'Chemistry', 'Commerce + Maths'],
      Thursday: ['Urdu', 'Physics', 'Islamiat'],
      Friday: ['Maths', 'Pak Studies', 'Chemistry', 'Biology + Urdu']
    },
    'O3': {
      Monday: ['Chemistry', 'Maths', 'Biology', 'Computer Science + Biology'],
      Tuesday: ['Physics', 'Chemistry', 'Business Studies'],
      Wednesday: ['Biology', 'Physics', 'Chemistry', 'Commerce + Maths'],
      Thursday: ['Physics', 'Chemistry', 'Maths'],
      Friday: ['Physics', 'Chemistry', 'Maths', 'Biology']
    }
  };

  const api = async (path, options = {}) => {
    if (!isConfigured) throw new Error('Supabase is not configured. Complete the setup steps in README.md before using school records.');
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method: options.method || 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${state.token}`,
        'Content-Type': 'application/json',
        ...(options.prefer ? { Prefer: options.prefer } : {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });
    const body = await response.text();
    if (!response.ok) {
      let message = body;
      try {
        const error = JSON.parse(body);
        message = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' · ') || body;
      } catch { /* Keep the server's response text. */ }
      throw new Error(message || `Request failed (${response.status}).`);
    }
    return body ? JSON.parse(body) : null;
  };
  const dateOffset = (iso, days) => {
    // Parse in Pakistan timezone (IST, UTC+5) for consistent date arithmetic
    const date = new Date(`${iso}T12:00:00`);
    date.setMinutes(date.getMinutes() + 5 * 60);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const syncAbsenteeRecords = async () => {
    if (!['developer', 'admin', 'teacher'].includes(state.profile?.role)) return;
    // Use the date as-is (local browser timezone) for report date
    const reportDate = todayISO();
    const existing = new Set((records('absentee_records') || []).filter(row => row.report_date === reportDate).map(row => row.student_id));
    const rows = (records('attendance') || [])
      .filter(row => row.attendance_date === reportDate && row.status === 'absent')
      .map(row => {
        const student = (records('students') || []).find(item => item.id === row.student_id);
        if (!student || existing.has(student.id)) return null;
        return {
          school_id: state.currentSchoolId,
          report_date: reportDate,
          class_id: student.class_id || row.class_id,
          student_id: student.id,
          status: 'absent'
        };
      })
      .filter(Boolean);
    if (!rows.length) return;
    await api('absentee_records?on_conflict=school_id,student_id,report_date', {
      method: 'POST',
      body: rows,
      prefer: 'resolution=merge-duplicates,return=minimal'
    });
  };



  const refreshData = async () => {
    const schools = await api('schools?select=*');
    state.data.schools = schools;
    if (!schools.some(school => school.id === state.currentSchoolId)) {
      state.currentSchoolId = schools.find(school => school.id === state.profile.school_id)?.id || schools[0]?.id || '';
    }
    if (!state.currentSchoolId) throw new Error('No school is available for this account. Ask the developer to configure a school.');
    const schoolFilter = `school_id=eq.${encodeURIComponent(state.currentSchoolId)}&select=*`;
    // Load core tables; school_holidays may not exist yet until the Supabase schema cache is refreshed.
    const loaded = await Promise.all([
      ['schools', await api('schools?select=*')],
      ['students', await api(`students?${schoolFilter}&order=student_id.asc&limit=10000`)],
      ['teachers', await api(`teachers?${schoolFilter}&order=teacher_id.asc&limit=10000`)],
      ['classes', await api(`classes?${schoolFilter}&order=name.asc&limit=10000`)],
      ['subjects', await api(`subjects?${schoolFilter}&order=name.asc&limit=10000`)],
      ['class_subjects', await api(`class_subjects?${schoolFilter}&limit=10000`)],
      ['subject_enrollments', await api(`subject_enrollments?${schoolFilter}&limit=10000`)],
      ['attendance', await api(`attendance?${schoolFilter}&limit=10000`)],
      ['subject_attendance', await api(`subject_attendance?${schoolFilter}&limit=10000`)],
      ['assessments', await api(`assessments?${schoolFilter}&order=title.asc&limit=10000`)],
      ['marks', await api(`marks?${schoolFilter}&limit=10000`)],
      ['parent_students', await api(`parent_students?${schoolFilter}&limit=10000`)],
      ['homework_diaries', await api(`homework_diaries?${schoolFilter}&limit=10000`)],
      ['homework_receipts', await api(`homework_receipts?${schoolFilter}&limit=10000`)],
      ['absentee_records', await api(`absentee_records?${schoolFilter}&limit=10000`)]
    ]);
    loaded.forEach(([table, rows]) => { state.data[table] = rows || []; });
    // school_holidays is optional until the Supabase schema cache is refreshed after deployment.
    try {
      state.data.school_holidays = await api(`school_holidays?${schoolFilter}`);
    } catch {
      state.data.school_holidays = [];
    }
    await syncAbsenteeRecords().catch(() => {});
    await refreshImageUrls();
  };

  const refreshImageUrls = async () => {
    const paths = [
      currentSchool().logo_path,
      ...records('students').map(row => row.photo_path),
      ...records('teachers').map(row => row.photo_path)
    ].filter(Boolean);
    const uniquePaths = [...new Set(paths)];
    const results = uniquePaths.map(path => {
      const objectPath = path.split('/').map(encodeURIComponent).join('/');
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/school-media/${objectPath}`;
      return [path, publicUrl];
    });
    state.imageUrls = Object.fromEntries(results.filter(Boolean));
  };

  const uploadImage = async (path, file) => {
    const objectPath = path.split('/').map(encodeURIComponent).join('/');
    const contentType = (file.type === 'image/jpg' ? 'image/jpeg' : (file.type || 'application/octet-stream'));
    const response = await fetch(`${supabaseUrl}/storage/v1/object/school-media/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${state.token}`,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: file
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Image upload failed (${response.status})${body ? `: ${body}` : ''}.`);
    }
    return path;
  };

  const removeImage = async path => {
    const objectPath = path.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${supabaseUrl}/storage/v1/object/school-media/${objectPath}`, {
      method: 'DELETE',
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${state.token}` }
    });
    if (!response.ok && response.status !== 404) throw new Error(`Could not remove the replaced image (${response.status}).`);
  };

  const fileDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });

  const photoExtension = path => {
    const extension = String(path || '').split('/').pop().split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? extension : 'jpg';
  };

  const mimeForExtension = extension => ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension] || 'image/jpeg');

  const migrateLegacyStudentPhotos = async () => {
    if (!isManager()) return;
    const pending = records('students').filter(student => {
      if (!student.photo_path) return false;
      const fileName = String(student.photo_path).split('/').pop() || '';
      return fileName.split('.')[0] !== student.id;
    });
    for (const student of pending) {
      const oldPath = student.photo_path;
      const extension = photoExtension(oldPath);
      const newPath = `${state.currentSchoolId}/students/${student.id}.${extension}`;
      try {
        const objectPath = oldPath.split('/').map(encodeURIComponent).join('/');
        const download = await fetch(`${supabaseUrl}/storage/v1/object/school-media/${objectPath}`, {
          headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${state.token}` }
        });
        if (!download.ok) throw new Error(`Could not read the existing photo (${download.status}).`);
        const blob = await download.blob();
        const file = blob.type ? blob : new Blob([blob], { type: mimeForExtension(extension) });
        await uploadImage(newPath, file);
        await api(`students?id=eq.${encodeURIComponent(student.id)}`, {
          method: 'PATCH',
          body: { photo_path: newPath },
          prefer: 'return=minimal'
        });
        student.photo_path = newPath;
        await removeImage(oldPath);
      } catch (error) {
        console.warn('Could not migrate the photo for student', student.id, error);
      }
    }
    if (pending.length) await refreshImageUrls();
  };

  const saveRow = async (table, row, id) => {
    const scopedRow = { ...row, school_id: state.currentSchoolId };
    if (id) {
      const savedRows = await api(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: scopedRow, prefer: 'return=representation' });
      if (!savedRows?.length) throw new Error(`Could not confirm that the ${formDefinitions[table].title.toLowerCase()} was saved.`);
      return savedRows[0];
    }
    const newId = row.id || crypto.randomUUID();
    const savedRows = await api(table, { method: 'POST', body: { ...scopedRow, id: newId }, prefer: 'return=representation' });
    if (!savedRows?.length) throw new Error(`Could not confirm that the ${formDefinitions[table].title.toLowerCase()} was saved.`);
    return savedRows[0];
  };

  const deleteDependents = async (table, id) => {
    const schoolId = state.currentSchoolId;
    const del = (target, filter) => api(`${target}?${filter}`, { method: 'DELETE', prefer: 'return=minimal' });
    if (table === 'students') {
      await del('attendance', `student_id=eq.${encodeURIComponent(id)}`);
      await del('subject_attendance', `student_id=eq.${encodeURIComponent(id)}`);
      await del('marks', `student_id=eq.${encodeURIComponent(id)}`);
      await del('subject_enrollments', `student_id=eq.${encodeURIComponent(id)}`);
      await del('parent_students', `student_id=eq.${encodeURIComponent(id)}`);
      await del('absentee_records', `student_id=eq.${encodeURIComponent(id)}`);
      await del('homework_receipts', `student_id=eq.${encodeURIComponent(id)}`);
    } else if (table === 'teachers') {
      await del('class_subjects', `teacher_id=eq.${encodeURIComponent(id)}`);
      await del('homework_diaries', `teacher_id=eq.${encodeURIComponent(id)}`);
    } else if (table === 'subjects') {
      const assignments = records('class_subjects').filter(row => row.subject_id === id);
      for (const assignment of assignments) {
        await del('subject_enrollments', `assignment_id=eq.${encodeURIComponent(assignment.id)}`);
        await del('subject_attendance', `subject_id=eq.${encodeURIComponent(id)}`);
      }
      const assessments = records('assessments').filter(row => row.subject_id === id);
      for (const assessment of assessments) {
        await del('marks', `assessment_id=eq.${encodeURIComponent(assessment.id)}`);
        await del('assessments', `id=eq.${encodeURIComponent(assessment.id)}`);
      }
      await del('class_subjects', `subject_id=eq.${encodeURIComponent(id)}`);
      await del('homework_diaries', `subject_id=eq.${encodeURIComponent(id)}`);
    } else if (table === 'classes') {
      const students = records('students').filter(row => row.class_id === id);
      for (const student of students) await deleteRow('students', student.id);
      const assignments = records('class_subjects').filter(row => row.class_id === id);
      for (const assignment of assignments) {
        await del('subject_enrollments', `assignment_id=eq.${encodeURIComponent(assignment.id)}`);
      }
      const assessments = records('assessments').filter(row => row.class_id === id);
      for (const assessment of assessments) {
        await del('marks', `assessment_id=eq.${encodeURIComponent(assessment.id)}`);
        await del('assessments', `id=eq.${encodeURIComponent(assessment.id)}`);
      }
      await del('class_subjects', `class_id=eq.${encodeURIComponent(id)}`);
      await del('attendance', `class_id=eq.${encodeURIComponent(id)}`);
      await del('subject_attendance', `class_id=eq.${encodeURIComponent(id)}`);
      await del('absentee_records', `class_id=eq.${encodeURIComponent(id)}`);
      await del('homework_diaries', `class_id=eq.${encodeURIComponent(id)}`);
    }
  };

  const deleteRow = async (table, id) => {
    const removed = records(table).find(row => row.id === id);
    await deleteDependents(table, id);
    await api(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    if (removed?.photo_path) await removeImage(removed.photo_path);
    await refreshData();
  };

  const permittedStudents = () => {
    const profile = state.profile || {};
    if (profile.role === 'student') return profile.student_id ? [profile.student_id] : [];
    if (profile.role === 'parent') {
      return profile.linked_student_ids || records('parent_students')
        .filter(link => link.parent_profile_id === profile.id)
        .map(link => link.student_id);
    }
    if (profile.role === 'teacher') {
      const classes = records('class_subjects')
        .filter(assignment => assignment.teacher_id === profile.teacher_id)
        .map(assignment => assignment.class_id);
      return records('students').filter(student => classes.includes(student.class_id)).map(student => student.id);
    }
    return records('students').map(student => student.id);
  };
  const attendanceStudents = () => {
    const permitted = new Set(permittedStudents());
    const assignment = attendanceAssignment();
    return records('students').filter(student => permitted.has(student.id) &&
      (!state.attendanceClass || student.class_id === state.attendanceClass) &&
      (!assignment || student.class_id === assignment.class_id));
  };
  const attendanceAssignment = () => records('class_subjects').find(row =>
    row.id === state.attendanceAssignmentId &&
    row.class_id === state.attendanceClass &&
    (isManager() || state.profile?.role !== 'teacher' || row.teacher_id === state.profile.teacher_id));
  const permittedAttendanceAssignments = () => records('class_subjects').filter(row =>
    (!state.attendanceClass || row.class_id === state.attendanceClass) &&
    (isManager() || row.teacher_id === state.profile?.teacher_id));
  const activeStudents = () => records('students').filter(student => student.status === 'Active');
  const schoolHolidays = () => records('school_holidays').filter(row => row.school_id === state.currentSchoolId);
  const isHoliday = dateISO => schoolHolidays().some(row => row.holiday_date === dateISO);
  const holidayTitle = dateISO => {
    const h = schoolHolidays().find(row => row.holiday_date === dateISO);
    return h ? h.title : '';
  };

  const classStrengthView = () => {
    const permitted = isManager() ? null : new Set(permittedStudents());
    const students = activeStudents().filter(student => !permitted || permitted.has(student.id));
    const classes = records('classes');
    const classRows = classes.map(item => {
      const roster = students.filter(student => student.class_id === item.id);
      return {
        id: item.id,
        name: item.name || `Grade ${item.grade || ''}`.trim() || 'Class',
        section: item.section || '—',
        boys: roster.filter(student => student.gender === 'Male').length,
        girls: roster.filter(student => student.gender === 'Female').length,
        total: roster.length
      };
    });
    const unassigned = students.filter(student => !student.class_id);
    const assignedActiveStudentCount = classRows.filter(row => row.id).reduce((total, row) => total + row.total, 0);
    if (unassigned.length) {
      classRows.push({
        id: '',
        name: 'Unassigned',
        section: '—',
        boys: unassigned.filter(student => student.gender === 'Male').length,
        girls: unassigned.filter(student => student.gender === 'Female').length,
        total: unassigned.length
      });
    }
    const boys = students.filter(student => student.gender === 'Male').length;
    const girls = students.filter(student => student.gender === 'Female').length;
    const activeClassCount = classRows.filter(row => row.id && row.total > 0).length;
    const classQuery = state.classStrengthSearch.trim().toLocaleLowerCase();
    const visibleClassRows = classRows.filter(row => `${row.name} ${row.section}`.toLocaleLowerCase().includes(classQuery));
    return `<section class="class-strength-panel panel" aria-labelledby="classStrengthTitle">
      <header class="strength-heading">
        <div class="strength-heading-copy"><span class="strength-heading-mark" aria-hidden="true">▦</span><div><div class="strength-title-row"><h2 id="classStrengthTitle">Class strength summary</h2><span class="live-roster-tag">Live roster</span></div><p>Active student enrollment and gender distribution across classes.</p></div></div>
        <button type="button" class="button button-primary strength-export" data-print-class-strength>Export as PDF</button>
      </header>
      <div class="strength-metrics">
        ${metric('Total enrolled strength', students.length, '♧', '<em>Active student records</em>')}
        ${metric('Active classes', activeClassCount, '▦', '<em>Classes with an active roster</em>')}
        ${metric('Boys strength', boys, '♂', `<em>${students.length ? Math.round(boys / students.length * 100) : 0}% of total</em>`)}
        ${metric('Girls strength', girls, '♀', `<em>${students.length ? Math.round(girls / students.length * 100) : 0}% of total</em>`)}
        ${metric('Average class size', activeClassCount ? (assignedActiveStudentCount / activeClassCount).toFixed(1) : '0', '◷', '<em>Students per active class</em>')}
      </div>
      <div class="strength-filter">
        <label for="classStrengthSearch">Search classes<input id="classStrengthSearch" type="search" value="${escapeHtml(state.classStrengthSearch)}" placeholder="Type a class or section"></label>
        <span id="classStrengthCount" role="status">Showing ${visibleClassRows.length} of ${classRows.length} Classes</span>
      </div>
      <div class="strength-table-wrap"><table class="data-table strength-table"><thead><tr><th>No.</th><th>Class name</th><th>Section</th><th>Boys</th><th>Girls</th><th>Total strength</th></tr></thead><tbody>
        ${classRows.length ? classRows.map((row, index) => `<tr data-class-strength-row data-search="${escapeHtml(`${row.name} ${row.section}`.toLocaleLowerCase())}" ${`${row.name} ${row.section}`.toLocaleLowerCase().includes(classQuery) ? '' : 'hidden'}><td>${index + 1}</td><td><strong>${escapeHtml(row.name)}</strong></td><td><span class="section-chip">${escapeHtml(row.section)}</span></td><td class="strength-boys">${row.boys}</td><td class="strength-girls">${row.girls}</td><td><span class="strength-total">${row.total}</span></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">No classes have been created yet.</td></tr>'}
        ${classRows.length ? `<tr id="classStrengthNoResults" ${visibleClassRows.length ? 'hidden' : ''}><td colspan="6" class="empty-state">No classes match this search.</td></tr>` : ''}
      </tbody><tfoot><tr><th colspan="3">School total strength</th><td>${boys}</td><td>${girls}</td><td>${students.length}</td></tr></tfoot></table></div>
      <footer class="strength-footer"><span>Active classes: <strong>${activeClassCount}</strong></span><span>Active enrolled strength: <strong>${students.length}</strong></span><span>Boys: <strong>${boys}</strong></span><span>Girls: <strong>${girls}</strong></span><small>Students not marked Male or Female are included in total strength, but not either gender count.</small></footer>
    </section>`;
  };

  const permittedAssessments = () => {
    if (isManager()) return records('assessments');
    const studentIds = new Set(permittedStudents());
    const classIds = new Set(records('students').filter(student => studentIds.has(student.id)).map(student => student.class_id));
    if (state.profile?.role === 'teacher') {
      const assignedClasses = new Set(records('class_subjects')
        .filter(assignment => assignment.teacher_id === state.profile.teacher_id)
        .map(assignment => assignment.class_id));
      return records('assessments').filter(assessment => assignedClasses.has(assessment.class_id));
    }
    return records('assessments').filter(assessment => classIds.has(assessment.class_id));
  };

  const permittedMarks = () => {
    const studentIds = new Set(permittedStudents());
    const assessmentIds = new Set(permittedAssessments().map(assessment => assessment.id));
    return records('marks').filter(mark => studentIds.has(mark.student_id) && assessmentIds.has(mark.assessment_id));
  };

  const openWorkspace = (profile, user = null, token = '') => {
    state.mode = 'live';
    state.profile = profile;
    state.user = user;
    state.token = token;
    $('#loginView').classList.add('hidden');
    $('#workspaceView').classList.remove('hidden');
    const name = profile.display_name || profile.full_name || user?.phone || user?.email || 'School user';
    $('#profileName').textContent = name;
    $('#profileRole').textContent = roleNames[profile.role] || 'School user';
    $('#profileInitials').textContent = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    $('#modeBadge').textContent = 'SECURE SCHOOL DATA';
    $('#modeBadge').classList.add('connected');
    const schoolPicker = $('#schoolPicker');
    schoolPicker.innerHTML = records('schools').map(school => `<option value="${escapeHtml(school.id)}" ${school.id === state.currentSchoolId ? 'selected' : ''}>${escapeHtml(school.id === state.currentSchoolId ? SCHOOL_NAME : school.name)}</option>`).join('');
    schoolPicker.classList.toggle('hidden', profile.role !== 'developer' || records('schools').length < 2);
    syncSchoolIdentity();
    const allowedViews = profile.role === 'developer'
      ? Object.keys(labels)
      : profile.role === 'admin'
        ? Object.keys(labels).filter(view => view !== 'accounts')
        : profile.role === 'teacher'
          ? ['overview', 'students', 'academics', 'attendance', 'assessments', 'reports', 'reportcards', 'credit', 'homework']
          : ['overview', 'attendance', 'assessments', 'reports', 'reportcards', 'credit', 'homework'];
    document.querySelectorAll('[data-view]').forEach(button => {
      const allowed = allowedViews.includes(button.dataset.view);
      button.classList.toggle('hidden', !allowed);
    });
    $('#navStudentCount').textContent = state.data.students.length;
    goToView('overview');
  };

  const syncSchoolIdentity = () => {
    const school = currentSchool();
    if (!school.id) return;
    $('#schoolName').textContent = SCHOOL_NAME;
    $('#schoolYear').textContent = `Academic year ${school.academic_year}`;
    const brandIcons = [$('#loginBrandIcon'), $('#workspaceBrandIcon')];
    brandIcons.forEach(icon => {
      icon.src = BRAND_LOGO;
    });
  };

  const logout = () => {
    state.token = '';
    state.user = null;
    state.profile = null;
    state.mode = 'unconfigured';
    state.currentSchoolId = '';
    state.imageUrls = {};
    state.data = Object.fromEntries(Object.keys(state.data).map(table => [table, []]));
    $('#workspaceBrandIcon').src = BRAND_LOGO;
    $('#workspaceView').classList.add('hidden');
    $('#loginView').classList.remove('hidden');
    const pw = $('#passwordInput'); if (pw) pw.value = '';
  };

  const normalizeMobile = raw => {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '92' + digits.slice(1);
    if (digits.length === 10 && digits.startsWith('3')) digits = '92' + digits;
    if (digits.length === 11 && digits.startsWith('3')) digits = '92' + digits;
    return digits;
  };
  const isValidPakistaniMobile = mobile => /^923[0-9]{9}$/.test(mobile);
  const mobileToEmail = mobile => `${mobile}@seeds.local`;
  const isRegisterMode = () => state.loginMode === 'register';

  const signIn = async event => {
    event.preventDefault();
    if (!isConfigured) {
      setLoginMessage('Supabase is not configured. Complete the setup steps in README.md before signing in.');
      return;
    }
    const mobile = normalizeMobile($('#mobileInput').value);
    if (!isValidPakistaniMobile(mobile)) {
      setLoginMessage('Enter a valid Pakistani mobile number (e.g. 03XX XXXXXXX).');
      return;
    }
    const submit = $('#loginSubmitButton');
    if (submit) submit.disabled = true;
    const email = mobileToEmail(mobile);
    const password = mobile;
    if (isRegisterMode()) {
      const fullName = String($('#registerNameInput').value || '').trim();
      if (fullName.length < 2) {
        setLoginMessage('Enter your full name to create an account.');
        if (submit) submit.disabled = false;
        return;
      }
      setLoginMessage('Creating your account…');
      try {
        await registerAccount({ mobile, full_name: fullName, role: state.selectedLoginRole });
        setLoginMessage('Account created. Signing you in…');
      } catch (error) {
        setLoginMessage(error instanceof Error ? error.message : 'Could not create account.');
        if (submit) submit.disabled = false;
        return;
      }
    }
    setLoginMessage('Signing in securely…');
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const auth = await response.json();
      if (!response.ok) throw new Error(auth.msg || auth.message || 'Sign in failed. Check your mobile number.');
      state.token = auth.access_token;
      state.user = auth.user;
      let profiles = await api(`profiles?id=eq.${encodeURIComponent(auth.user.id)}&select=*`);
      if (!profiles.length) {
        // Auto-create a developer profile when signing in as developer with no existing profile.
        if (state.selectedLoginRole === 'developer') {
          const schoolsResp = await api('schools?select=*');
          const school = schoolsResp?.[0] || null;
          if (!school) throw new Error('No school exists yet. Ask an administrator to create a school first.');
          const created = await api('profiles', {
            method: 'POST',
            body: {
              id: auth.user.id,
              school_id: school.id,
              role: 'developer',
              display_name: 'Developer',
              teacher_id: null,
              student_id: null
            },
            prefer: 'return=representation'
          });
          if (!created?.length) throw new Error('Could not create developer profile. Ask your administrator for help.');
          profiles = created;
        } else {
          throw new Error('Your account has no school profile yet. Ask your administrator for help.');
        }
      }
      state.profile = profiles[0];
      if (state.profile.role !== state.selectedLoginRole) {
        throw new Error(`This is a ${roleNames[state.profile.role] || 'different'} account. Choose the matching account type and try again.`);
      }
      state.currentSchoolId = state.profile.school_id;
      await refreshData();
      await migrateLegacyStudentPhotos();
      if (['developer', 'admin'].includes(state.profile.role) && currentSchool().name !== SCHOOL_NAME) {
        await api(`schools?id=eq.${encodeURIComponent(state.currentSchoolId)}`, {
          method: 'PATCH',
          body: { name: SCHOOL_NAME },
          prefer: 'return=minimal'
        });
        currentSchool().name = SCHOOL_NAME;
      }
      openWorkspace(state.profile, auth.user, auth.access_token);
    } catch (error) {
      state.token = '' ;
      state.user = null;
      setLoginMessage(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      if (submit) submit.disabled = false;
    }
  };

  const allowedRows = table => {
    let rows = records(table);
    if (table === 'students') {
      const permitted = new Set(permittedStudents());
      rows = rows.filter(row => permitted.has(row.id));
    }
    if (table === 'students' && state.search) {
      const query = state.search.toLowerCase();
      rows = rows.filter(row => [row.full_name, row.student_id, className(row.class_id)].some(value => String(value || '').toLowerCase().includes(query)));
    }
    if (table === 'teachers' && state.search) {
      const query = state.search.toLowerCase();
      rows = rows.filter(row => {
        const assignments = records('class_subjects').filter(assignment => assignment.teacher_id === row.id);
        const subjects = [...new Set(assignments.map(assignment => subjectName(assignment.subject_id)))];
        const classes = [...new Set(assignments.map(assignment => className(assignment.class_id)))];
        return [row.full_name, row.teacher_id, row.email, ...subjects, ...classes]
          .some(value => String(value || '').toLowerCase().includes(query));
      });
    }
    return rows;
  };

  const pageHeading = (eyebrow, title, subtitle, actions = '') => `
    <div class="page-heading">
      <div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>
      ${actions ? `<div class="heading-actions">${actions}</div>` : ''}
    </div>`;

  const metric = (label, value, icon, foot) => `
    <article class="metric-card"><div class="metric-top"><span>${escapeHtml(label)}</span><span class="metric-icon">${icon}</span></div>
    <div class="metric-value">${escapeHtml(value)}</div><div class="metric-foot">${foot}</div></article>`;

  const photo = (row, fallback) => imageSrc(row)
    ? `<img class="person-photo" src="${escapeHtml(imageSrc(row))}" alt="">`
    : `<span class="table-avatar">${escapeHtml(fallback)}</span>`;

  const studentsTable = (rows, controls = true) => {
    if (!rows.length) return `<div class="empty-state"><strong>No student records yet</strong>Add students to start tracking classes, attendance, and results.</div>`;
    const canManage = isManager();
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Sr. No.</th><th>Student</th><th>Student ID</th><th>Roll No.</th><th>Class</th><th>Guardian</th><th>Status</th>${canManage ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map((row, index) => `<tr><td>${index + 1}</td><td><div class="person-cell">${photo(row, row.full_name.split(/\s+/).map(part => part[0]).slice(0, 2).join(''))}<span><strong>${escapeHtml(row.full_name)}</strong><small>${escapeHtml(row.gender || 'Student')}</small></span></div></td><td>${escapeHtml(row.student_id || 'Assigned on save')}</td><td>${escapeHtml(studentRollNumber(row))}</td><td>${escapeHtml(className(row.class_id))}</td><td>${escapeHtml(row.guardian_name || '—')}</td><td><span class="status-pill">${escapeHtml(row.status || 'Active')}</span></td>${canManage ? `<td><button class="text-button" data-action="edit" data-table="students" data-id="${escapeHtml(row.id)}">Edit</button> <button class="text-button danger-text" data-action="delete" data-table="students" data-id="${escapeHtml(row.id)}">Remove</button></td>` : ''}</tr>`).join('')}
    </tbody></table></div>`;
  };

  const teachersTable = rows => {
    if (!rows.length) return `<div class="empty-state"><strong>No teacher records yet</strong>Add teachers and assign subjects to their classes.</div>`;
    const canManage = isManager();
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Teacher</th><th>Teacher ID</th><th>Email</th><th>Phone</th><th>Subjects assigned</th><th>Classes assigned</th><th>Status</th>${canManage ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map(row => {
        const assignments = records('class_subjects').filter(assignment => assignment.teacher_id === row.id);
        const subjects = [...new Set(assignments.map(assignment => subjectName(assignment.subject_id)))];
        const classes = [...new Set(assignments.map(assignment => className(assignment.class_id)))];
        return `<tr><td><div class="person-cell">${photo(row, row.full_name.split(/\s+/).map(part => part[0]).slice(0, 2).join(''))}<span><strong>${escapeHtml(row.full_name)}</strong><small>Faculty member</small></span></div></td><td>${escapeHtml(row.teacher_id || 'Assigned on save')}</td><td>${escapeHtml(row.email || '—')}</td><td>${escapeHtml(row.phone || '—')}</td><td>${subjects.length ? subjects.map(escapeHtml).join(', ') : '—'}</td><td>${classes.length ? classes.map(escapeHtml).join(', ') : '—'}</td><td><span class="status-pill">${escapeHtml(row.status || 'Active')}</span></td>${canManage ? `<td><button class="text-button" data-action="edit" data-table="teachers" data-id="${escapeHtml(row.id)}">Edit</button> <button class="text-button danger-text" data-action="delete" data-table="teachers" data-id="${escapeHtml(row.id)}">Remove</button></td>` : ''}</tr>`;
      }).join('')}
    </tbody></table></div>`;
  };

  const overviewView = () => {
    const students = allowedRows('students');
    const totalAttendance = records('attendance').filter(row => row.attendance_date === state.attendanceDate);
    const present = totalAttendance.filter(row => row.status === 'present').length;
    const attendanceRate = totalAttendance.length ? Math.round(present / totalAttendance.length * 100) : 0;
    const chartData = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((month, index) => ({ month, value: [48, 63, 56, 76, 68, 86][index] }));
    const assessmentRows = records('assessments').slice(0, 4);
    const recent = [
      ...assessmentRows.map(item => ({ icon: '▤', title: item.title, detail: `${className(item.class_id)} · ${subjectName(item.subject_id)}`, time: item.assessment_date })),
      { icon: '✓', title: `${present} students marked present`, detail: 'Attendance updated today', time: 'Today' }
    ].slice(0, 4);
    const todayLabel = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    return `${pageHeading(todayLabel, `Good day, ${escapeHtml((state.profile.display_name || 'there').split(' ')[0])}.`, 'Here is what is happening across your school today.', isManager() ? '<button class="button button-outline button-small" data-action="export">Export report</button><button class="button button-primary button-small" data-action="add" data-table="students">＋ Add student</button>' : '')}
      ${isManager() || state.profile.role === 'teacher' ? classStrengthView() : ''}
      <div class="metrics-grid">
        ${metric('Total students', students.length, '♧', '<em>Academic year 2026</em>')}
        ${metric('Teaching staff', records('teachers').length, '♙', '<em>Faculty directory</em>')}
        ${metric('Attendance today', `${attendanceRate}%`, '✓', `${present} present · ${totalAttendance.length - present} absent / leave / holiday`)}
        ${metric('Assessments', records('assessments').length, '▤', '<em>Monthly and term exams</em>')}
      </div>
      <div class="dashboard-grid">
        <section class="panel"><header class="panel-header"><div><h2>Academic progress</h2><p>Assessment performance over the school year</p></div><button class="button button-outline button-small" data-view="reports">View reports</button></header><div class="panel-body"><div class="chart-area">${chartData.map(item => `<div class="chart-column"><div class="chart-bars" style="--bar:${item.value}"></div><span>${item.month}</span></div>`).join('')}</div></div></section>
        <section class="panel"><header class="panel-header"><div><h2>Attendance today</h2><p>School-wide attendance overview</p></div><button class="text-button" data-view="attendance">Details →</button></header><div class="panel-body"><div class="attendance-ring"><div class="ring"><strong>${attendanceRate}%</strong></div><div class="ring-legend"><div class="legend-row"><i class="legend-dot"></i> Present <strong>${present}</strong></div><div class="legend-row"><i class="legend-dot absent"></i> Absent <strong>${totalAttendance.filter(row => row.status === 'absent').length}</strong></div><div class="legend-row"><i class="legend-dot leave"></i> Leave <strong>${totalAttendance.filter(row => row.status === 'leave').length}</strong></div></div></div></div></section>
      </div>
      <div class="dashboard-grid">
        <section class="panel"><header class="panel-header"><div><h2>Recently added students</h2><p>Student directory overview</p></div><button class="text-button" data-view="students">View all →</button></header><div class="panel-body">${studentsTable(students.slice(0, 4), false)}</div></section>
        <section class="panel"><header class="panel-header"><div><h2>Recent activity</h2><p>Latest academic updates</p></div></header><div class="panel-body"><div class="activity-list">${recent.map(item => `<div class="activity-item"><span class="activity-symbol">${item.icon}</span><span class="activity-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><span class="activity-time">${escapeHtml(item.time)}</span></div>`).join('')}</div></div></section>
      </div>`;
  };

  const directoryView = (table, title, subtitle, actionLabel) => {
    const rows = allowedRows(table);
    const isStudentDirectory = table === 'students';
    const filteredRows = isStudentDirectory && isManager() && state.studentDirectoryClass
      ? rows.filter(row => row.class_id === state.studentDirectoryClass)
      : rows;
    const classSelector = isStudentDirectory && isManager()
      ? `<select id="studentDirectoryClass" class="field-select"><option value="">All classes</option>${records('classes').map(row => `<option value="${escapeHtml(row.id)}" ${row.id === state.studentDirectoryClass ? 'selected' : ''}>${escapeHtml(row.name)}</option>`).join('')}</select>
         <button class="button button-outline button-small" data-action="select-student-class">Select Class</button>`
      : '';
    const add = isManager() ? `<button class="button button-primary button-small" data-action="add" data-table="${table}">＋ ${actionLabel}</button>` : '';
    const actions = isManager() ? `${classSelector} ${add}` : '';
    return `${pageHeading('PEOPLE DIRECTORY', title, subtitle, actions)}
      <div class="table-toolbar"><input id="tableSearch" class="table-search" type="search" value="${escapeHtml(state.search)}" placeholder="Search by name, ID, or class…" aria-label="Search records"><span class="summary-chip">${filteredRows.length} records</span></div>
      ${table === 'students' ? studentsTable(filteredRows) : teachersTable(rows)}`;
  };

  const classesAndSubjectsView = () => {
    const canManage = isManager();
    const action = (table, label) => canManage ? `<button class="button button-outline button-small" data-action="add" data-table="${table}">＋ ${label}</button>` : '';
    return `${pageHeading('ACADEMIC STRUCTURE', 'Classes & subjects', 'Organize classes and assign subject teachers.', '')}
      <div class="dashboard-grid">
        <section class="panel"><header class="panel-header"><div><h2>Classes</h2><p>${records('classes').length} active classes</p></div>${action('classes', 'Class')}</header><div class="panel-body">${records('classes').length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Class</th><th>Students</th>${canManage ? '<th></th>' : ''}</tr></thead><tbody>${records('classes').map(item => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td>${records('students').filter(student => student.class_id === item.id).length}</td>${canManage ? `<td><button class="text-button" data-action="edit" data-table="classes" data-id="${escapeHtml(item.id)}">Edit</button> <button class="text-button danger-text" data-action="delete" data-table="classes" data-id="${escapeHtml(item.id)}">Remove</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No classes added.</div>'}</div></section>
        <section class="panel"><header class="panel-header"><div><h2>Subjects</h2><p>${records('subjects').length} subjects in the curriculum</p></div>${action('subjects', 'Subject')}</header><div class="panel-body">${records('subjects').length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Subject</th><th>Code</th>${canManage ? '<th></th>' : ''}</tr></thead><tbody>${records('subjects').map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.code || '—')}</td>${canManage ? `<td><button class="text-button" data-action="edit" data-table="subjects" data-id="${escapeHtml(item.id)}">Edit</button> <button class="text-button danger-text" data-action="delete" data-table="subjects" data-id="${escapeHtml(item.id)}">Remove</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No subjects added.</div>'}</div></section>
      </div>
      <section class="panel" style="margin-top:15px"><header class="panel-header"><div><h2>Teaching assignments</h2><p>Class, subject, and responsible teacher</p></div>${action('class_subjects', 'Assignment')}</header><div class="panel-body">${records('class_subjects').length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Class</th><th>Subject</th><th>Teacher</th>${canManage ? '<th></th>' : ''}</tr></thead><tbody>${records('class_subjects').map(item => `<tr><td>${escapeHtml(className(item.class_id))}</td><td>${escapeHtml(subjectName(item.subject_id))}</td><td>${escapeHtml(teacherName(item.teacher_id))}</td>${canManage ? `<td><button class="text-button" data-action="delete" data-table="class_subjects" data-id="${escapeHtml(item.id)}">Remove</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No teacher assignments yet.</div>'}</div></section>`;
  };

  const attendanceView = () => {
    const school = currentSchool();
    if (state.attendanceViewMode === 'monthly') return monthlyAttendanceView(school);
    const assignment = attendanceAssignment();
    const classIds = state.profile.role === 'teacher'
      ? new Set(records('class_subjects').filter(row => row.teacher_id === state.profile.teacher_id).map(row => row.class_id))
      : null;
    const classes = records('classes').filter(row => !classIds || classIds.has(row.id));
    const classOptions = `<option value="">All classes</option>${classes.map(row => `<option value="${escapeHtml(row.id)}" ${state.attendanceClass === row.id ? 'selected' : ''}>${escapeHtml(row.name)}</option>`).join('')}`;
    const subjectAssignments = permittedAttendanceAssignments();
    const assignmentOptions = `<option value="">Class register (no subject)</option>${subjectAssignments.map(row => `<option value="${escapeHtml(row.id)}" ${state.attendanceAssignmentId === row.id ? 'selected' : ''}>${escapeHtml(className(row.class_id))} · ${escapeHtml(subjectName(row.subject_id))}</option>`).join('')}`;
    const permitted = new Set(permittedStudents());
    const rows = attendanceStudents();
    const attendanceRecords = assignment ? records('subject_attendance') : records('attendance');
    const attendanceIndex = new Map(attendanceRecords.filter(row =>
      row.attendance_date === state.attendanceDate && permitted.has(row.student_id) &&
      (!state.attendanceClass || row.class_id === state.attendanceClass) &&
      (!assignment || row.subject_id === assignment.subject_id))
      .map(row => [row.student_id, row]));
    const canTakeAttendance = isManager() || (state.profile.role === 'teacher' && assignment?.teacher_id === state.profile.teacher_id);
    const dateValue = new Date(`${state.attendanceDate}T12:00:00`);
    const weekday = new Intl.DateTimeFormat('en', { weekday: 'short' }).format(dateValue);
    const calendarBaseDate = Number.isNaN(dateValue.getTime()) ? new Date() : dateValue;
    const calendarYear = calendarBaseDate.getFullYear();
    const calendarMonth = calendarBaseDate.getMonth();
    const calendarMonthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(calendarBaseDate);
    const calendarDays = Array.from({ length: new Date(calendarYear, calendarMonth + 1, 0).getDate() }, (_, index) => {
      const dayDate = new Date(calendarYear, calendarMonth, index + 1);
      // Use Pakistan timezone for calendar day ISO dates
      const dayISO = pakistanDateISO(dayDate);
      return { number: index + 1, iso: dayISO, weekend: dayDate.getDay() === 0 || dayDate.getDay() === 6 };
    });
    const calendarLeadingBlanks = new Date(calendarYear, calendarMonth, 1).getDay();
    const rangeLength = state.attendanceRangeMode && state.attendanceRangeStart && state.attendanceRangeEnd
      ? Math.round((new Date(`${state.attendanceRangeEnd}T12:00:00`) - new Date(`${state.attendanceRangeStart}T12:00:00`)) / 86400000) + 1
      : 1;
    const statusOptions = [
      { value: 'present', short: 'P', label: 'Present' },
      { value: 'absent', short: 'A', label: 'Absent' },
      { value: 'leave', short: 'L', label: 'Leave' },
      { value: 'holiday', short: 'H', label: 'Holiday' }
    ];
    const counts = statusOptions.map(status => ({
      ...status,
      count: rows.filter(student => (state.attendanceStatuses[student.id] || attendanceIndex.get(student.id)?.status || 'present') === status.value).length
    }));
    const session = school.academic_year || String(new Date().getFullYear());
    const selectedName = state.attendanceClass
      ? records('classes').find(row => row.id === state.attendanceClass)?.name || 'Selected class'
      : 'All classes';
    return `<section class="attendance-register">
      <div class="attendance-view-switch"><div><p class="eyebrow">${assignment ? 'SUBJECT ATTENDANCE' : 'CLASS ATTENDANCE'}</p><h1>Attendance</h1><p>${assignment ? 'A separate register maintained by the assigned subject teacher.' : 'Record and review class attendance.'}</p>${assignment ? `<span class="attendance-subject-context">Subject register: <strong>${escapeHtml(subjectName(assignment.subject_id))}</strong> · ${escapeHtml(className(assignment.class_id))} · Teacher: ${escapeHtml(teacherName(assignment.teacher_id))}</span>` : ''}</div><div class="attendance-view-buttons"><button type="button" class="button ${state.attendanceViewMode === 'daily' ? 'button-primary' : 'button-outline'}" data-attendance-view="daily">Daily register</button><button type="button" class="button ${state.attendanceViewMode === 'monthly' ? 'button-primary' : 'button-outline'}" data-attendance-view="monthly">Monthly sheet</button></div></div>
      <div class="attendance-control-card">
        <div class="attendance-filter-grid">
          <label class="attendance-filter"><span>Academic session</span><select id="attendanceSession" class="field-select"><option>${escapeHtml(session)}</option></select></label>
          <label class="attendance-filter"><span>Class cluster</span><select id="attendanceClass" class="field-select">${classOptions}</select></label>
          <label class="attendance-filter"><span>Subject register</span><select id="attendanceAssignment" class="field-select">${assignmentOptions}</select></label>
          <div class="attendance-date-group"><span class="attendance-filter-caption">Temporal date node</span><div class="attendance-date-controls">
            <button class="date-step" type="button" data-date-step="-1" aria-label="Previous day">‹</button>
            <input id="attendanceDate" class="field-input" type="date" value="${escapeHtml(state.attendanceDate)}" aria-label="Attendance date">
            <button class="date-step" type="button" data-date-step="1" aria-label="Next day">›</button>
            <span class="weekday-chip">${escapeHtml(weekday)}</span>
          </div></div>
        </div>
        ${canTakeAttendance ? `<div class="ledger-control">
          <div class="ledger-copy"><span class="ledger-bolt">↯</span><div><strong>Batch ledger control</strong><small>Mark the entire class at once</small></div></div>
          <div class="ledger-actions">${statusOptions.map(status => `<button type="button" class="ledger-action" data-batch-status="${status.value}" title="Mark all ${escapeHtml(selectedName)} students ${escapeHtml(status.label.toLowerCase())}">${status.short}</button>`).join('')}
            <label class="range-mode-toggle"><input id="attendanceRangeMode" type="checkbox" ${state.attendanceRangeMode ? 'checked' : ''}> Range mode</label>
          </div>
        </div>
        ${state.attendanceRangeMode ? `<div class="attendance-range-panel"><span>Apply marked statuses to each date in the selected range</span><label>From <input id="attendanceRangeStart" class="field-input" type="date" value="${escapeHtml(state.attendanceRangeStart)}"></label><label>To <input id="attendanceRangeEnd" class="field-input" type="date" value="${escapeHtml(state.attendanceRangeEnd)}"></label><strong>${rangeLength > 0 ? `${rangeLength} day${rangeLength === 1 ? '' : 's'}` : 'Choose a valid date range'}</strong></div>` : ''}` : ''}
        ${state.profile.role === 'teacher' && !assignment ? '<p class="subject-register-notice">Choose one of your assigned subject registers before entering attendance. Each subject is saved separately.</p>' : ''}
      </div>
      <div class="attendance-calendar-panel">
        <div class="attendance-calendar-header">
          <button type="button" class="date-step" data-calendar-month="-1" aria-label="Previous month">‹</button>
          <strong>${escapeHtml(calendarMonthLabel)}</strong>
          <button type="button" class="date-step" data-calendar-month="1" aria-label="Next month">›</button>
        </div>
        <div class="attendance-calendar-grid">
          ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => `<span class="attendance-calendar-weekday">${day}</span>`).join('')}
          ${Array.from({ length: calendarLeadingBlanks }, () => '<span class="attendance-calendar-blank"></span>').join('')}
          ${calendarDays.map(day => {
            const isHol = isHoliday(day.iso);
            return `<button type="button" class="attendance-calendar-day ${day.iso === state.attendanceDate ? 'selected' : ''} ${day.weekend ? 'weekend' : ''} ${isHol ? 'holiday' : ''}" data-attendance-date="${escapeHtml(day.iso)}" ${isHol ? 'disabled' : ''} title="${isHol ? escapeHtml(holidayTitle(day.iso)) : ''}">${day.number}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="attendance-list">
        <div class="attendance-list-header"><span>${assignment ? `${escapeHtml(subjectName(assignment.subject_id))} · ${escapeHtml(className(assignment.class_id))} students` : 'Class students · Daily marking mode'}</span><span>Status</span></div>
        ${rows.length ? rows.map((student, index) => {
          const attendanceRecord = attendanceIndex.get(student.id);
          const status = state.attendanceStatuses[student.id] || attendanceRecord?.status || 'present';
          const selectedStatus = statusOptions.find(option => option.value === status) || statusOptions[0];
          return `<article class="attendance-student-row ${canTakeAttendance ? 'editable' : ''}" data-row-student="${escapeHtml(student.id)}">
            <span class="attendance-row-number">#${index + 1}</span>
            <div class="attendance-student-photo">${photo(student, student.full_name.split(/\s+/).map(part => part[0]).slice(0, 2).join(''))}</div>
            <div class="attendance-student-info"><strong>${escapeHtml(student.full_name)}</strong><div class="attendance-student-meta"><span class="attendance-id">ID: ${escapeHtml(student.student_id || 'Not assigned')}</span><span class="attendance-gender">${escapeHtml((student.gender || '—').slice(0, 1))}</span><span>Roll: ${escapeHtml(student.roll_number || String(index + 1).padStart(2, '0'))}</span><span class="attendance-status-label status-${status}">${escapeHtml(selectedStatus.label)}</span></div></div>
            <div class="attendance-status-choices">${statusOptions.map(option => `<button type="button" class="attendance-choice status-${option.value} ${status === option.value ? 'selected' : ''}" data-student-status="${escapeHtml(option.value)}" data-student="${escapeHtml(student.id)}" aria-pressed="${status === option.value}" aria-label="${escapeHtml(option.label)} for ${escapeHtml(student.full_name)}" ${canTakeAttendance ? '' : 'disabled'}><strong>${option.short}</strong><small>${escapeHtml(option.label)}</small></button>`).join('')}</div>
          </article>`;
        }).join('') : '<div class="empty-state"><strong>No students in this class</strong>Add students before taking attendance.</div>'}
      </div>
      ${canTakeAttendance && rows.length ? `<div class="attendance-save-bar"><div class="attendance-summary">${counts.map(item => `<span class="attendance-summary-item status-${item.value}"><i></i>${escapeHtml(item.label)} <strong>${item.count}</strong></span>`).join('')}<span class="attendance-total">${rows.length} students${state.attendanceRangeMode && rangeLength > 0 ? ` · ${rangeLength} days` : ''}</span></div><button id="saveAttendance" class="button button-primary">${state.attendanceRangeMode ? 'Save attendance range' : 'Save daily register'} <span aria-hidden="true">→</span></button></div>` : ''}
    </section>`;
  };

  const monthlyAttendanceView = school => {
    const assignment = attendanceAssignment();
    const [yearText, monthText] = state.attendanceMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const validMonth = /^\d{4}-\d{2}$/.test(state.attendanceMonth) && month >= 1 && month <= 12;
    const dayCount = validMonth ? new Date(year, month, 0).getDate() : 0;
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(year, month - 1, index + 1);
      return { number: index + 1, date, weekend: date.getDay() === 0 || date.getDay() === 6 };
    });
    const permitted = new Set(permittedStudents());
    const students = records('students').filter(student => permitted.has(student.id) &&
      (!state.attendanceClass || student.class_id === state.attendanceClass) &&
      (!assignment || student.class_id === assignment.class_id));
    const studentIds = new Set(students.map(student => student.id));
    const monthStart = validMonth ? `${state.attendanceMonth}-01` : '';
    const monthEnd = validMonth ? `${state.attendanceMonth}-${String(dayCount).padStart(2, '0')}` : '';
    const attendanceRecords = assignment ? records('subject_attendance') : records('attendance');
    const monthRecords = attendanceRecords.filter(row =>
      row.attendance_date >= monthStart && row.attendance_date <= monthEnd &&
      studentIds.has(row.student_id) &&
      (!assignment || row.subject_id === assignment.subject_id));
    const attendanceByStudent = new Map();
    for (const row of monthRecords) {
      if (!attendanceByStudent.has(row.student_id)) attendanceByStudent.set(row.student_id, new Map());
      const dayMatch = row.attendance_date.match(/^(\d{4})-(\d{2})-(\d{2})/);
      attendanceByStudent.get(row.student_id).set(dayMatch ? Number(dayMatch[3]) : NaN, row.status);
    }
    const statusCodes = { present: 'P', absent: 'A', leave: 'L', holiday: 'H' };
    const countsByDay = days.map(day => students.reduce((count, student) =>
      count + (attendanceByStudent.get(student.id)?.get(day.number) === 'present' ? 1 : 0), 0));
    const selectedClass = records('classes').find(row => row.id === state.attendanceClass);
    const classIds = state.profile.role === 'teacher'
      ? new Set(records('class_subjects').filter(row => row.teacher_id === state.profile.teacher_id).map(row => row.class_id))
      : null;
    const classes = records('classes').filter(row => !classIds || classIds.has(row.id));
    const classOptions = `<option value="">All classes</option>${classes.map(row =>
      `<option value="${escapeHtml(row.id)}" ${state.attendanceClass === row.id ? 'selected' : ''}>${escapeHtml(row.name)}</option>`).join('')}`;
    const subjectAssignments = permittedAttendanceAssignments();
    const assignmentOptions = `<option value="">Class register (no subject)</option>${subjectAssignments.map(row =>
      `<option value="${escapeHtml(row.id)}" ${state.attendanceAssignmentId === row.id ? 'selected' : ''}>${escapeHtml(className(row.class_id))} · ${escapeHtml(subjectName(row.subject_id))}</option>`).join('')}`;
    const assignedTeacherIds = assignment
      ? [assignment.teacher_id]
      : selectedClass
      ? [...new Set(records('class_subjects').filter(row => row.class_id === selectedClass.id).map(row => row.teacher_id))]
      : [];
    const assignedTeachers = assignedTeacherIds.map(id => records('teachers').find(row => row.id === id)?.full_name).filter(Boolean);
    const monthLabel = validMonth
      ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
      : 'Choose a month';
    const monthName = validMonth ? new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year, month - 1, 1)) : '';
    const session = school.academic_year || String(new Date().getFullYear());
    const schoolLogo = state.imageUrls[school.logo_path] || '';
    return `<section class="monthly-attendance-page ${state.attendancePrintOrientation === 'portrait' ? 'print-portrait' : 'print-landscape'}">
      <div class="monthly-export-toolbar">
        <strong><span aria-hidden="true">▤</span> Official Export Node</strong>
        <div class="monthly-export-actions">
          <div class="orientation-toggle" aria-label="Print orientation">
            <button type="button" class="${state.attendancePrintOrientation === 'portrait' ? 'selected' : ''}" data-print-orientation="portrait">Portrait</button>
            <button type="button" class="${state.attendancePrintOrientation === 'landscape' ? 'selected' : ''}" data-print-orientation="landscape">Landscape</button>
          </div>
          <button type="button" class="button button-outline" data-attendance-view="daily">‹ Register View</button>
          <button type="button" class="button button-primary print-sheet-button" data-print-attendance>▣ Print Transcript</button>
        </div>
      </div>
      <div class="monthly-filter-row">
        <label class="attendance-filter">Class cluster<select id="attendanceClass" class="field-select">${classOptions}</select></label>
        <label class="attendance-filter">Subject register<select id="attendanceAssignment" class="field-select">${assignmentOptions}</select></label>
        <label class="attendance-filter">Month<input id="attendanceMonth" class="field-input" type="month" value="${escapeHtml(validMonth ? state.attendanceMonth : '')}"></label>
        <span>Academic session: <strong>${escapeHtml(session)}</strong></span>
      </div>
      <div class="monthly-sheet">
        <header class="monthly-sheet-heading">
          <div class="monthly-school-brand"><span class="monthly-logo">${schoolLogo ? `<img src="${escapeHtml(schoolLogo)}" alt="">` : `<img src="${BRAND_LOGO}" alt="">`}</span><div><strong>${escapeHtml(SCHOOL_NAME)}</strong><span>${assignment ? `${escapeHtml(subjectName(assignment.subject_id))} · Subject Attendance Report` : 'Monthly Attendance Report'}</span></div></div>
          <strong class="monthly-date-stamp">${escapeHtml(monthLabel)}</strong>
        </header>
        <div class="monthly-class-meta">
          <strong>CLASS: ${escapeHtml(selectedClass?.name || 'ALL CLASSES')}</strong>
          <strong>${assignment ? 'SUBJECT TEACHER' : 'ASSIGNED TEACHER(S)'}: ${escapeHtml(assignedTeachers.length ? assignedTeachers.join(', ') : 'Not assigned')}</strong>
          <strong>MONTH: ${escapeHtml(monthName.toUpperCase() || '—')}</strong>
          <strong>COUNT: ${students.length} CANDIDATES</strong>
        </div>
        ${students.length && validMonth ? `<div class="monthly-table-scroll"><table class="monthly-register-table">
          <thead><tr><th class="monthly-student-heading" rowspan="2">Student Name</th><th class="monthly-gender-heading" rowspan="2">G</th>${days.map(day => `<th class="monthly-day-heading ${day.weekend ? 'weekend' : ''}">${day.number}</th>`).join('')}<th rowspan="2">W</th><th rowspan="2">H</th><th rowspan="2">P</th><th rowspan="2">L</th><th rowspan="2">A</th></tr><tr>${days.map(day => `<th class="monthly-weekday-heading ${day.weekend ? 'weekend' : ''}">${new Intl.DateTimeFormat('en', { weekday: 'short' }).format(day.date).slice(0, 1)}</th>`).join('')}</tr></thead>
          <tbody>${students.map(student => {
            const studentDays = attendanceByStudent.get(student.id) || new Map();
            const totals = { present: 0, absent: 0, leave: 0, holiday: 0 };
            const monthMatch = state.attendanceMonth.match(/^(\d{4})-(\d{2})$/);
            const attendanceMonthNum = monthMatch ? monthMatch[2] : '';
            const monthlyTotalsForStudent = student.monthlyTotals && student.monthlyTotals[attendanceMonthNum]
              ? student.monthlyTotals[attendanceMonthNum]
              : { P: 0, A: 0, L: 0, H: 0 };
            const dailyCells = days.map(day => {
              const status = studentDays.get(day.number);
              if (status in totals) totals[status]++;
              const code = statusCodes[status] || (!status && day.weekend ? 'S' : '');
              return `<td class="monthly-status-cell ${status ? `status-${status}` : day.weekend ? 'status-weekend' : ''}" title="${status ? escapeHtml(status[0].toUpperCase() + status.slice(1)) : day.weekend ? 'Weekend' : 'No record'}">${code}</td>`;
            }).join('');
            return `<tr><td class="monthly-student-cell"><div class="monthly-student-photo">${photo(student, student.full_name.split(/\s+/).map(part => part[0]).slice(0, 2).join(''))}</div><div class="monthly-student-name"><strong>${escapeHtml(student.full_name)}</strong><small>ID: ${escapeHtml(student.student_id || 'Not assigned')}</small></div></td><td class="monthly-gender-cell">${escapeHtml((student.gender || '—').slice(0, 1))}</td>${dailyCells}<td>${totals.present + totals.absent + totals.leave}</td><td>${totals.holiday}</td><td>${totals.present}</td><td>${totals.leave}</td><td>${totals.absent}</td><td>${monthlyTotalsForStudent.P}</td><td>${monthlyTotalsForStudent.A}</td><td>${monthlyTotalsForStudent.L}</td><td>${monthlyTotalsForStudent.H}</td></tr>`;
          }).join('')}</tbody>
          <tfoot><tr><th colspan="2" class="daily-present-label">DAILY PRESENT</th>${countsByDay.map((count, index) => `<td class="${days[index].weekend ? 'weekend' : ''}">${count || ''}</td>`).join('')}<td colspan="5"></td></tr></tfoot>
        </table></div><p class="monthly-key"><strong>KEY:</strong> P Present · A Absent · L Leave · H Holiday · S Weekend · W Working entries</p>` : `<div class="empty-state"><strong>${validMonth ? 'No students in this class' : 'Choose a month'}</strong>${validMonth ? 'Add students and assign them to a class to print a register.' : 'Select a valid month to display the attendance sheet.'}</div>`}
        <footer class="monthly-signatures"><div><span></span><strong>Class Teacher Signature</strong><small>DATE: __________________</small></div><div><span></span><strong>Principal Signature</strong><small>DATE: __________________</small></div></footer>
      </div>
    </section>`;
  };

  const gradebookAssignments = () => {
    const studentIds = new Set(permittedStudents());
    return records('class_subjects').filter(assignment => {
      if (isManager()) return true;
      if (state.profile.role === 'teacher') return assignment.teacher_id === state.profile.teacher_id;
      return records('subject_enrollments').some(enrollment =>
        enrollment.assignment_id === assignment.id && studentIds.has(enrollment.student_id));
    });
  };

  const normalizedTerm = term => /^(2|second)/i.test(String(term || '').trim()) ? '2nd Term' : '1st Term';
  const termMonths = {
    '1st Term': [{ month: 9, label: 'September' }, { month: 10, label: 'October' }, { month: 11, label: 'November' }],
    '2nd Term': [{ month: 2, label: 'February' }, { month: 3, label: 'March' }, { month: 4, label: 'April' }]
  };
  const gradeForPercentage = percentage => percentage >= 90 ? 'A*' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : percentage >= 40 ? 'E' : 'U';
  const formatGradebookNumber = value => Number(value.toFixed(2)).toString();
  const isAbsentEntry = value => /^(a|absent)$/i.test(String(value || '').trim());
  const enteredScore = value => {
    const text = String(value || '').trim();
    if (!text || isAbsentEntry(text)) return null;
    const score = Number(text);
    return Number.isFinite(score) ? score : NaN;
  };

  const gradebookRowTotals = row => {
    const terms = [...new Set([...row.querySelectorAll('.gradebook-score')].map(input => input.dataset.term))];
    terms.forEach(term => {
      const inputs = [...row.querySelectorAll('.gradebook-score')].filter(input => input.dataset.term === term);
      const monthlyInputs = inputs.filter(input => input.dataset.category === 'monthly');
      const examInputs = inputs.filter(input => input.dataset.category === 'exam');
      const enteredMonthly = monthlyInputs.map(input => enteredScore(input.value)).filter(score => score !== null && Number.isFinite(score));
      const monthlyComplete = Number(row.querySelector(`[data-monthly-setup="${term}"]`)?.dataset.monthlyCount || 0) === 3;
      const marksIn60 = monthlyComplete ? enteredMonthly.reduce((sum, score) => sum + score, 0) / enteredMonthly.length * 3 || 0 : null;
      const testPercentage = marksIn60 === null ? null : marksIn60 / 60 * 100;
      const enteredExams = examInputs.map(input => ({ score: enteredScore(input.value), max: Number(input.max) }))
        .filter(item => item.score !== null && Number.isFinite(item.score));
      const examPossible = enteredExams.reduce((sum, item) => sum + item.max, 0);
      const examPercentage = examPossible ? enteredExams.reduce((sum, item) => sum + item.score, 0) / examPossible * 100 : null;
      const finalPercentage = testPercentage === null || examPercentage === null ? null : (testPercentage + examPercentage) / 2;
      const monthlyCell = row.querySelector(`[data-monthly-total="${term}"]`);
      const examCell = row.querySelector(`[data-exam-percentage="${term}"]`);
      const percentageCell = row.querySelector(`[data-final-percentage="${term}"]`);
      const gradeCell = row.querySelector(`[data-grade="${term}"]`);
      if (monthlyCell) monthlyCell.textContent = marksIn60 === null ? '—' : `${formatGradebookNumber(marksIn60)} / 60`;
      if (examCell) examCell.textContent = examPercentage === null ? '—' : `${formatGradebookNumber(examPercentage)}%`;
      if (percentageCell) percentageCell.textContent = finalPercentage === null ? '—' : `${finalPercentage.toFixed(1).replace(/\.0$/, '')}%`;
      if (gradeCell) gradeCell.textContent = finalPercentage === null ? '—' : gradeForPercentage(finalPercentage);
    });
  };

  const assessmentsView = () => {
    const assignments = gradebookAssignments();
    const selectedAssignment = assignments.find(row => row.id === state.assessmentAssignmentId) || assignments[0] || null;
    if (selectedAssignment && selectedAssignment.id !== state.assessmentAssignmentId) state.assessmentAssignmentId = selectedAssignment.id;
    const availableClasses = [...new Map(assignments.map(assignment => {
      const klass = records('classes').find(row => row.id === assignment.class_id);
      return [klass?.id, klass];
    }).filter(([id, klass]) => id && klass)).values()];
    const classId = selectedAssignment?.class_id || '';
    const availableAssignments = assignments.filter(row => row.class_id === classId);
    const selectedTerm = state.assessmentTerm;
    const canManage = isManager();
    const canManageRoster = Boolean(selectedAssignment &&
      (isManager() || (state.profile.role === 'teacher' && selectedAssignment.teacher_id === state.profile.teacher_id)));
    const canMark = canManageRoster;
    const permitted = new Set(permittedStudents());
    const classStudents = selectedAssignment
      ? records('students').filter(student => student.class_id === selectedAssignment.class_id && permitted.has(student.id))
      : [];
    const enrolledIds = new Set(records('subject_enrollments')
      .filter(item => item.assignment_id === selectedAssignment?.id)
      .map(item => item.student_id));
    const enrolledStudents = classStudents.filter(student => enrolledIds.has(student.id));
    const visibleStudents = state.assessmentShowWholeClass ? classStudents : enrolledStudents;
    const termsToShow = state.assessmentShowBothTerms ? ['1st Term', '2nd Term'] : [selectedTerm];
    const assessmentRows = selectedAssignment
      ? permittedAssessments().filter(row =>
        row.class_id === selectedAssignment.class_id &&
        row.subject_id === selectedAssignment.subject_id &&
        termsToShow.includes(normalizedTerm(row.term)))
        .sort((a, b) => a.assessment_date.localeCompare(b.assessment_date) || a.title.localeCompare(b.title))
      : [];
    const termGroups = termsToShow.map(term => {
      const rows = assessmentRows.filter(row => normalizedTerm(row.term) === term);
      return {
        term,
        months: termMonths[term].map(month => ({
          ...month,
          assessment: rows.find(row => row.assessment_type === 'Monthly test' &&
            Number(String(row.assessment_date || '').slice(5, 7)) === month.month) || null
        })),
        exams: rows.filter(row => row.assessment_type === 'Term exam')
      };
    });
    const classOptions = availableClasses.map(row =>
      `<option value="${escapeHtml(row.id)}" ${row.id === classId ? 'selected' : ''}>${escapeHtml(row.name)}</option>`).join('');
    const subjectOptions = availableAssignments.map(row =>
      `<option value="${escapeHtml(row.id)}" ${row.id === selectedAssignment?.id ? 'selected' : ''}>${escapeHtml(subjectName(row.subject_id))}</option>`).join('');
    const termButtons = ['1st Term', '2nd Term'].map(term =>
      `<button type="button" class="gradebook-term-button ${!state.assessmentShowBothTerms && selectedTerm === term ? 'selected' : ''}" data-gradebook-term="${term}" aria-pressed="${!state.assessmentShowBothTerms && selectedTerm === term}">${term}</button>`).join('');
    const addAssessment = canMark && selectedAssignment
      ? '<button type="button" class="button button-primary button-small" data-action="add" data-table="assessments">＋ New assessment</button>'
      : '';
    const markLookup = new Map(records('marks').map(mark => [`${mark.assessment_id}:${mark.student_id}`, mark]));
    const tableRows = visibleStudents.map((student, index) => {
      const isEnrolled = enrolledIds.has(student.id);
      return `<tr data-gradebook-row><td class="gradebook-row-number">#${index + 1}</td><td class="gradebook-student"><strong>${escapeHtml(student.full_name)}</strong><small>ID: ${escapeHtml(student.student_id || 'Not assigned')} · Roll: ${escapeHtml(student.roll_number || String(index + 1).padStart(2, '0'))}</small>${!isEnrolled ? '<span class="gradebook-not-enrolled">Not enrolled</span>' : ''}</td><td class="gradebook-gender">${escapeHtml((student.gender || '—').slice(0, 1))}</td>${termGroups.map(group => {
        const groupMonthly = group.months.map(month => {
          if (!month.assessment) return `<td class="gradebook-not-setup" title="${month.label} assessment has not been set up">Not set</td>`;
          const mark = markLookup.get(`${month.assessment.id}:${student.id}`);
          const editable = canMark && isEnrolled;
          return `<td><input class="field-input gradebook-score" data-assessment-id="${escapeHtml(month.assessment.id)}" data-student="${escapeHtml(student.id)}" data-category="monthly" data-term="${group.term}" type="text" inputmode="decimal" value="${mark ? escapeHtml(mark.score) : ''}" placeholder="A / score" aria-label="${month.label} score or absent for ${escapeHtml(student.full_name)}" ${editable ? '' : 'disabled'}></td>`;
        }).join('');
        const groupExams = group.exams.map(assessment => {
          const mark = markLookup.get(`${assessment.id}:${student.id}`);
          const editable = canMark && isEnrolled;
          return `<td><input class="field-input gradebook-score" data-assessment-id="${escapeHtml(assessment.id)}" data-student="${escapeHtml(student.id)}" data-category="exam" data-term="${group.term}" type="number" min="0" max="${Number(assessment.max_marks)}" step="0.01" value="${mark ? escapeHtml(mark.score) : ''}" placeholder="—" aria-label="${escapeHtml(assessment.title)} score for ${escapeHtml(student.full_name)}" ${editable ? '' : 'disabled'}></td>`;
        }).join('');
        const monthlyAssessments = group.months.map(month => month.assessment).filter(Boolean);
        const monthlyScores = group.months
          .map(month => month.assessment && markLookup.get(`${month.assessment.id}:${student.id}`))
          .filter(Boolean)
          .map(mark => Number(mark.score));
        const marksIn60 = monthlyAssessments.length === 3
          ? (monthlyScores.length ? monthlyScores.reduce((sum, score) => sum + score, 0) / monthlyScores.length * 3 : 0)
          : null;
        const markedExams = group.exams.map(assessment => ({
          assessment,
          mark: markLookup.get(`${assessment.id}:${student.id}`)
        })).filter(item => item.mark);
        const examMax = markedExams.reduce((sum, item) => sum + Number(item.assessment.max_marks), 0);
        const examEarned = markedExams.reduce((sum, item) => sum + Number(item.mark.score), 0);
        const examPercentage = examMax ? examEarned / examMax * 100 : null;
        const testPercentage = marksIn60 === null ? null : marksIn60 / 60 * 100;
        const finalPercentage = testPercentage === null || examPercentage === null
          ? null
          : (testPercentage + examPercentage) / 2;
        return `${groupMonthly}<td class="gradebook-monthly-sum" data-monthly-total="${group.term}">${marksIn60 === null ? '—' : `${formatGradebookNumber(marksIn60)} / 60`}</td>${groupExams}<td class="gradebook-exam-percentage" data-exam-percentage="${group.term}">${examPercentage === null ? '—' : `${formatGradebookNumber(examPercentage)}%`}</td><td class="gradebook-percentage" data-final-percentage="${group.term}">${finalPercentage === null ? '—' : `${finalPercentage.toFixed(1).replace(/\.0$/, '')}%`}</td><td class="gradebook-grade" data-grade="${group.term}">${finalPercentage === null ? '—' : gradeForPercentage(finalPercentage)}</td><td hidden data-monthly-setup="${group.term}" data-monthly-count="${monthlyAssessments.length}"></td>`;
      }).join('')}</tr>`;
    }).join('');
    const groupHeaders = `<tr><th rowspan="2">S#</th><th rowspan="2">Student</th><th rowspan="2">G</th>${termGroups.map(group => `<th colspan="${7 + group.exams.length}">${group.term}</th>`).join('')}</tr><tr>${termGroups.map(group => `${group.months.map(month => `<th>${month.label}<small>${month.assessment ? 'Max 20' : 'Not set'}</small></th>`).join('')}<th>Marks in 60</th>${group.exams.map(assessment => `<th>${escapeHtml(assessment.title)}<small>Max ${escapeHtml(assessment.max_marks)}</small></th>`).join('')}<th>Exam %</th><th>Final %</th><th>Grade</th>`).join('')}</tr>`;
    const tableColumnCount = 3 + termGroups.reduce((total, group) => total + 7 + group.exams.length, 0);
    const incompleteTerms = termGroups.filter(group => group.months.some(month => !month.assessment));
    const enrollmentEditor = state.assessmentEnrollOpen && canManageRoster && selectedAssignment
      ? `<section class="gradebook-enrollment-editor"><div class="gradebook-editor-heading"><div><strong>Assign students to ${escapeHtml(subjectName(selectedAssignment.subject_id))}</strong><small>Select the students who take this subject.</small></div><button type="button" class="button button-outline button-small" data-gradebook-enrollment-toggle>Close</button></div><div class="gradebook-enrollment-list">${classStudents.map(student => `<label><input type="checkbox" data-enroll-student value="${escapeHtml(student.id)}" ${enrolledIds.has(student.id) ? 'checked' : ''}><span><strong>${escapeHtml(student.full_name)}</strong><small>${escapeHtml(student.student_id || 'No student ID')}</small></span></label>`).join('')}</div><button type="button" class="button button-primary button-small" data-save-enrollment>Save subject students</button></section>`
      : '';
    const assessmentManager = canManageRoster && assessmentRows.length
      ? `<details class="gradebook-assessment-manager"><summary>Assessment setup · ${assessmentRows.length} items</summary><div class="table-wrap"><table class="data-table"><thead><tr><th>Assessment</th><th>Type</th><th>Date</th><th>Maximum</th><th></th></tr></thead><tbody>${assessmentRows.map(row => `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.assessment_type)}</td><td>${escapeHtml(row.assessment_date)}</td><td>${escapeHtml(row.max_marks)}</td><td><button class="text-button" data-action="edit" data-table="assessments" data-id="${escapeHtml(row.id)}">Edit</button> <button class="text-button danger-text" data-action="delete" data-table="assessments" data-id="${escapeHtml(row.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div></details>`
      : '';
    const session = currentSchool().academic_year || String(new Date().getFullYear());
    const assignmentTeacher = selectedAssignment ? teacherName(selectedAssignment.teacher_id) : '';
    const viewControls = selectedAssignment
      ? `<div class="gradebook-roster-bar"><div class="gradebook-roster-copy"><span aria-hidden="true">♟</span><div><strong>Listing <b>${enrolledStudents.length}</b> of ${classStudents.length} students enrolled in ${escapeHtml(subjectName(selectedAssignment.subject_id))}</strong><small>${state.assessmentShowWholeClass ? 'Entire class shown. Unenrolled students are view-only.' : 'Unenrolled class members are hidden.'}${assignmentTeacher ? ` · Subject teacher: ${escapeHtml(assignmentTeacher)}` : ''}</small></div></div><div class="gradebook-roster-actions">${canManageRoster ? `<button type="button" class="button button-primary button-small" data-gradebook-enrollment-toggle>Assign students (${enrolledStudents.length}/${classStudents.length})</button>` : ''}<button type="button" class="button button-outline button-small" data-gradebook-view-all>${state.assessmentShowWholeClass ? 'Show enrolled only' : `View entire class (${classStudents.length})`}</button></div></div>${enrollmentEditor}`
      : '<div class="empty-state"><strong>No subject assignment available</strong>Ask an administrator to assign a subject and teacher to this class.</div>';
    const markableAssessmentCount = assessmentRows.length;
    return `${pageHeading('ASSESSMENTS · SUBJECT GRADEBOOK', 'Test & exam marks entry', 'Enter term marks in a separate gradebook for each subject teacher.', addAssessment)}
      <section class="gradebook-filter-card">
        <label class="attendance-filter"><span>Session</span><select class="field-select" disabled><option>${escapeHtml(session)}</option></select></label>
        <div class="gradebook-term-picker" role="group" aria-label="Select academic term">${termButtons}<button type="button" class="gradebook-both-button ${state.assessmentShowBothTerms ? 'selected' : ''}" data-gradebook-both aria-pressed="${state.assessmentShowBothTerms}">Toggle both terms</button></div>
        <label class="attendance-filter"><span>Class cluster</span><select id="gradebookClass" class="field-select" ${availableClasses.length ? '' : 'disabled'}>${classOptions || '<option value="">No classes assigned</option>'}</select></label>
        <label class="attendance-filter"><span>Subject node</span><select id="gradebookSubject" class="field-select" ${availableAssignments.length ? '' : 'disabled'}>${subjectOptions || '<option value="">No subject assignments</option>'}</select></label>
      </section>
      ${viewControls}
      ${selectedAssignment ? `<section class="gradebook-panel panel"><header class="gradebook-panel-heading"><div><h2>${escapeHtml(className(selectedAssignment.class_id))} · ${escapeHtml(subjectName(selectedAssignment.subject_id))} marks</h2><p>${state.assessmentShowBothTerms ? 'Both terms' : selectedTerm} · Monthly scores convert to 60; final % is the average of test % and exam %.</p></div><div>${canManageRoster && markableAssessmentCount ? '<button type="button" id="saveMarks" class="button button-primary button-small">Save marks</button>' : ''}</div></header>${incompleteTerms.length ? `<div class="callout gradebook-setup-note"><strong>Monthly setup incomplete.</strong> Add one 20-mark test for each month before the “Marks in 60” total and final grade can be calculated for ${incompleteTerms.map(group => group.term).join(' and ')}.</div>` : ''}<div class="gradebook-table-wrap"><table class="gradebook-table"><thead>${groupHeaders}</thead><tbody>${tableRows || `<tr><td colspan="${tableColumnCount}" class="empty-state">No enrolled students in this view.</td></tr>`}</tbody></table></div><footer class="gradebook-footer"><span>Blank, A, or Absent monthly entry = absent. Attended test marks are scaled to 60.</span><span>A* ≥ 90 · A ≥ 80 · B ≥ 70 · C ≥ 60 · D ≥ 50 · E ≥ 40 · U &lt; 40 · Final % = (test % + exam %) ÷ 2</span></footer></section>` : ''}
      ${assessmentManager}`;
  };

  const reportsView = () => {
    const date = state.absenteeDate || todayISO();
    state.absenteeDate = date;
    const permitted = new Set(permittedStudents());
    const absentRows = records('attendance')
      .filter(row => row.attendance_date === date && row.status === 'absent' && permitted.has(row.student_id))
      .map((row, index) => {
        const student = records('students').find(item => item.id === row.student_id);
        if (!student) return '';
        const initials = student.full_name.split(/\s+/).map(part => part[0]).slice(0, 2).join('');
        return `<tr>
          <td>${index + 1}</td>
          <td>${photo(student, initials)}</td>
          <td><strong>${escapeHtml(student.full_name)}</strong></td>
          <td>${escapeHtml(className(student.class_id))}</td>
          <td>${escapeHtml(date)}</td>
        </tr>`;
      })
      .filter(Boolean);
    return `${pageHeading('STUDENTS DAILY ABSENTEE REPORT', 'Students daily absentee report', 'Daily list of students marked absent, saved with class and date.', '')}
      <div class="table-toolbar">
        <label class="field-label">Date <input id="absenteeDate" class="field-input" type="date" value="${escapeHtml(date)}"></label>
        <span class="summary-chip">${absentRows.length} absent</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Sr. No.</th><th>Photo</th><th>Name of student</th><th>Class</th><th>Date of absentee</th></tr></thead>
          <tbody>${absentRows.length ? absentRows.join('') : '<tr><td colspan="5"><div class="empty-state">No absent students recorded for this date.</div></td></tr>'}</tbody>
        </table>
      </div>`;
  };

  const reportCardMonths = () => termMonths[normalizedTerm(state.reportCardTerm)];

  const reportCardScopeMonths = (scope = state.reportCardScope) => {
    const months = reportCardMonths();
    if (!months.length) return [];
    if (scope === 'term') return months;
    const stored = Number(state.reportCardMonth);
    const match = months.find(item => item.month === stored);
    return match ? [match] : [months[0]];
  };

  const reportCardSubjectSummaries = (student, scope) => {
    const term = normalizedTerm(state.reportCardTerm);
    const month = Number(state.reportCardMonth || 0);
    const years = reportCardTermYears(state.reportCardTerm);
    const markIndex = new Map(records('marks').map(mark => [`${mark.assessment_id}:${mark.student_id}`, mark]));
    const assignments = records('class_subjects').filter(row => row.class_id === student.class_id);
    return assignments.map(assignment => {
      const assessments = records('assessments').filter(row => {
        if (row.class_id !== student.class_id || row.subject_id !== assignment.subject_id) return false;
        if (normalizedTerm(row.term) !== term) return false;
        const date = String(row.assessment_date || '');
        if (!years.includes(Number(date.slice(0, 4)))) return false;
        if (scope === 'term') return true;
        return row.assessment_type === 'Monthly test' && Number(date.slice(5, 7)) === month;
      }).sort((a, b) => a.assessment_date.localeCompare(b.assessment_date));
      const total = assessments.reduce((sum, row) => sum + Number(row.max_marks), 0);
      const obtained = assessments.reduce((sum, row) => {
        const mark = markIndex.get(`${row.id}:${student.id}`);
        return sum + (mark ? Number(mark.score) : 0);
      }, 0);
      const percentage = total ? obtained / total * 100 : null;
      return {
        subject: subjectName(assignment.subject_id),
        teacher: teacherName(assignment.teacher_id),
        total,
        obtained,
        percentage,
        grade: percentage === null ? '—' : gradeForPercentage(percentage)
      };
    }).filter(row => row.total > 0);
  };

  const reportCardTermYears = (term) => {
    const baseYear = Number(currentSchool().academic_year) || new Date().getFullYear();
    return normalizedTerm(term) === '2nd Term' ? [baseYear + 1] : [baseYear];
  };

  // Term exams are scheduled in December (1st Term) and May (2nd Term), so a
  // term report must include that month when totalling attendance.
  const reportCardAttendanceMonths = scope => {
    const months = reportCardScopeMonths(scope);
    if (scope !== 'term') return months;
    const examMonth = normalizedTerm(state.reportCardTerm) === '2nd Term' ? 5 : 12;
    return months.some(item => item.month === examMonth)
      ? months
      : [...months, { month: examMonth, label: 'Term exam' }];
  };

  const studentRollNumber = student => {
    const stored = String(student.roll_number || '').trim();
    if (stored) return stored;
    const classmates = records('students')
      .filter(row => row.class_id === student.class_id)
      .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
    const position = classmates.findIndex(row => row.id === student.id);
    return position >= 0 ? String(position + 1).padStart(2, '0') : '—';
  };

  const reportCardAttendanceSummary = (student, scope) => {
    const scopeMonths = reportCardAttendanceMonths(scope);
    const years = reportCardTermYears(state.reportCardTerm);
    const rows = records('attendance').filter(row => {
      if (row.student_id !== student.id) return false;
      const date = String(row.attendance_date || '');
      const month = Number(date.slice(5, 7));
      const year = Number(date.slice(0, 4));
      return scopeMonths.some(item => item.month === month) && years.includes(year);
    });
    const present = rows.filter(row => row.status === 'present').length;
    const absent = rows.filter(row => row.status === 'absent').length;
    const leave = rows.filter(row => row.status === 'leave').length;
    const workingDates = new Set(rows.filter(row => row.status !== 'holiday').map(row => row.attendance_date));
    const workingDays = workingDates.size;
    return {
      workingDays,
      present,
      absent,
      leave,
      rate: workingDays ? Math.round(present / workingDays * 100) : 0
    };
  };

  const reportCardRemark = (average, scope) => {
    if (average === null) return 'No marks have been recorded for this period yet.';
    if (average >= 90) return 'Excellent performance. Keep up the outstanding work and continue refining advanced skills.';
    if (average >= 80) return 'Very good performance. Maintain consistency and aim for excellence.';
    if (average >= 70) return 'Good performance. A little more practice will secure a higher grade.';
    if (average >= 60) return 'Satisfactory performance. More revision and regular practice are advised.';
    if (average >= 50) return 'Fair performance. Focused study and teacher support can improve results.';
    if (average >= 40) return 'Needs improvement. Concentrate on weak subjects and complete all assignments.';
    return 'Below 40% average. Immediate remedial support and consistent practice are required.';
  };
// Calculate monthly attendance totals (P/A/L/H counts) per student per month
const calculateMonthlyTotals = () => {
  const allRecords = records('attendance');
  // Group by student_id and month (MM from YYYY-MM-DD)
  const monthlyMap = new Map(); // key: `${student_id}-${month}`

  for (const row of allRecords) {
    if (!row.student_id || !row.attendance_date) continue;
    const studentId = row.student_id;
    const date = String(row.attendance_date);
    const month = date.slice(5, 7); // MM
    const status = row.status || '';

    const key = `${studentId}-${month}`;
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { P: 0, A: 0, L: 0, H: 0 });
    }
    const counts = monthlyMap.get(key);
    if (status === 'present') counts.P++;
    else if (status === 'absent') counts.A++;
    else if (status === 'leave') counts.L++;
    else if (status === 'holiday') counts.H++;
  }

  // Attach monthlyTotals to each student record
  const students = records('students');
  for (const student of students) {
    student.monthlyTotals = {};
    // Collect distinct months this student has records for
    const studentMonths = new Set();
    for (const row of allRecords) {
      if (row.student_id !== student.id) continue;
      const month = String(row.attendance_date).slice(5, 7);
      studentMonths.add(month);
    }
    for (const month of studentMonths) {
      const key = `${student.id}-${month}`;
      student.monthlyTotals[month] = monthlyMap.get(key) || { P: 0, A: 0, L: 0, H: 0 };
    }
  }
};

// Calculate term totals by summing monthly totals across term months
// Term months: 1st Term = Sep-Nov (9,10,11), 2nd Term = Feb-Apr (2,3,4)
const calculateTermTotals = () => {
  const term = normalizedTerm(state.reportCardTerm);
  const termMonthMap = {
    '1st Term': [9, 10, 11],
    '2nd Term': [2, 3, 4]
  };
  const monthNumbers = termMonthMap[term] || [];

  const students = records('students');
  for (const student of students) {
    student.termTotals = { P: 0, A: 0, L: 0, H: 0 };

    if (!student.monthlyTotals) continue;

    for (const month of monthNumbers) {
      const monthly = student.monthlyTotals[month];
      if (monthly) {
        student.termTotals.P += monthly.P || 0;
        student.termTotals.A += monthly.A || 0;
        student.termTotals.L += monthly.L || 0;
        student.termTotals.H += monthly.H || 0;
      }
    }
  }
};

// Populate monthlyTotals and termTotals when switching to attendance view
if (state.view === 'attendance') {
  calculateMonthlyTotals();
  calculateTermTotals();
}

  const reportCardGraph = (points, passLine, compact = false) => {
    const width = 520;
    const height = compact ? 74 : 120;
    const pad = compact
      ? { top: 8, right: 10, bottom: 16, left: 26 }
      : { top: 12, right: 12, bottom: 22, left: 32 };
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;
    const scale = value => pad.top + innerHeight - (Math.max(0, Math.min(100, value)) / 100) * innerHeight;
    const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;
    const coordinates = points.map((point, index) => ({
      x: pad.left + (points.length > 1 ? index * step : innerWidth / 2),
      y: scale(point.percentage ?? 0)
    }));
    const line = coordinates.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const area = coordinates.length
      ? `${line} L${coordinates[coordinates.length - 1].x.toFixed(1)},${(pad.top + innerHeight).toFixed(1)} L${coordinates[0].x.toFixed(1)},${(pad.top + innerHeight).toFixed(1)} Z`
      : '';
    const gridLines = [0, 25, 50, 75, 100].map(value =>
      `<line x1="${pad.left}" y1="${scale(value).toFixed(1)}" x2="${width - pad.right}" y2="${scale(value).toFixed(1)}" stroke="#e4e8e4" stroke-width="1"/>
       <text x="${pad.left - 5}" y="${(scale(value) + 3).toFixed(1)}" text-anchor="end" font-size="${compact ? 7 : 8}" fill="#8b958e">${value}</text>`).join('');
    const markers = coordinates.map((point, index) =>
      `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${compact ? 2.4 : 3}" fill="#1a6a4e"/>
       <text x="${point.x.toFixed(1)}" y="${(pad.top + innerHeight + (compact ? 11 : 13)).toFixed(1)}" text-anchor="middle" font-size="${compact ? 7 : 8}" fill="#6b766e">${escapeHtml(points[index].label.slice(0, compact ? 5 : 6))}</text>`).join('');
    const passY = scale(passLine);
    return `<svg class="report-card-graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="Subject marks trend">
      ${gridLines}
      <line x1="${pad.left}" y1="${passY.toFixed(1)}" x2="${width - pad.right}" y2="${passY.toFixed(1)}" stroke="#e0a23a" stroke-width="1.4" stroke-dasharray="5 4"/>
      ${area ? `<path d="${area}" fill="rgba(26,106,78,.08)"/>` : ''}
      ${coordinates.length ? `<path d="${line}" fill="none" stroke="#1a6a4e" stroke-width="2"/>` : ''}
      ${markers}
    </svg>`;
  };

  const reportCardSheet = (student, scope) => {
    const school = currentSchool();
    const term = normalizedTerm(state.reportCardTerm);
    const months = reportCardScopeMonths(scope);
    const monthLabel = scope === 'term' ? term : months[0]?.label || 'Month';
    const session = school.academic_year || String(new Date().getFullYear());
    const sessionLabel = /^\d{4}$/.test(session) ? `${session}-${Number(session) + 1}` : session;
    const logo = school.logo_path ? (state.imageUrls[school.logo_path] || '') : BRAND_LOGO;
    const subjects = reportCardSubjectSummaries(student, scope);
    const attendance = reportCardAttendanceSummary(student, scope);
    const scored = subjects.filter(row => row.percentage !== null);
    const average = scored.length
      ? Math.round(scored.reduce((sum, row) => sum + row.percentage, 0) / scored.length)
      : null;
    const gender = student.gender || 'Not stated';
    const photo = imageSrc(student);
    const rollNumber = studentRollNumber(student);
    const title = scope === 'term'
      ? `TERM REPORT CARD - ${term.toUpperCase()}`
      : `MONTHLY PROGRESS REPORT - ${String(monthLabel).toUpperCase()}`;
    const subjectRows = subjects.length
      ? subjects.map((row, index) => `<tr>
          <td class="report-card-subject-sn">${index + 1}</td>
          <td class="report-card-subject">${escapeHtml(row.subject)}</td>
          <td>${escapeHtml(row.total)}</td>
          <td>${escapeHtml(row.obtained)}</td>
          <td>${row.percentage === null ? '—' : `${Math.round(row.percentage)}%`}</td>
          <td>${escapeHtml(row.grade)}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="report-card-empty">No assessments recorded for this period.</td></tr>';
    const graphPoints = subjects.map(row => ({ label: row.subject, percentage: row.percentage }));
    const high = graphPoints.length ? Math.max(...graphPoints.map(point => point.percentage ?? 0)) : 0;
    const low = graphPoints.length ? Math.min(...graphPoints.map(point => point.percentage ?? 0)) : 0;
    const trend = graphPoints.length < 2 ? 'Not enough data' : high - low > 20 ? 'Volatile' : high - low > 10 ? 'Steady' : 'Consistent';
    return `<article class="report-card-sheet report-card-sheet--${scope === 'term' ? 'term' : 'monthly'}">
      <header class="report-card-head">
        <div class="report-card-brand">
          <span class="report-card-logo"><img src="${escapeHtml(logo)}" alt=""></span>
          <div>
            <strong>${escapeHtml(school.name || SCHOOL_NAME)}</strong>
            <span>INSTITUTIONAL REPORTING CENTRE</span>
            <span class="report-card-brand-sub">${scope === 'term' ? 'TERMLY PROGRESS REPORT' : `${escapeHtml(String(school.name || SCHOOL_NAME).split(/\s+/)[0].toUpperCase())} ACADEMIC PROGRESS SHEET`}</span>
          </div>
        </div>
        <div class="report-card-stamp">
          <strong>${escapeHtml(String(monthLabel).toUpperCase())}</strong>
          <span>SESSION ${escapeHtml(scope === 'term' ? session : sessionLabel)}</span>
        </div>
      </header>
      <section class="report-card-identity">
        <div class="report-card-identity-lines">
          <h2 class="report-card-title">${escapeHtml(title)}</h2>
          <p><span>Student Name: <strong>${escapeHtml(student.full_name)}</strong></span><span class="report-card-gender">Gender: <strong>${escapeHtml(gender.slice(0, 1).toUpperCase())}</strong>${scope === 'term' ? ` (${escapeHtml(gender)})` : ` <em class="report-card-gender-badge">${escapeHtml(gender)}</em>`}</span></p>
          <p>Student ID: <strong>${escapeHtml(student.student_id || 'Not assigned')}</strong></p>
          <p>Roll No: <strong>${escapeHtml(rollNumber)}</strong></p>
          <p>Grade: <strong>${escapeHtml(className(student.class_id))}</strong></p>
        </div>
        <span class="report-card-photo">${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(student.full_name)}">` : '<em>No photo</em>'}</span>
      </section>
      <table class="report-card-table">
        <thead><tr><th>S.n</th><th>Subject</th><th>Total</th><th>Obtained</th><th>Achievement Index</th><th>Grade</th></tr></thead>
        <tbody>${subjectRows}</tbody>
      </table>
      <div class="report-card-panels">
        <section class="report-card-panel report-card-attendance">
          <h3>${scope === 'term' ? 'TERM ATTENDANCE' : 'MONTHLY ATTENDANCE'}</h3>
          <table class="report-card-attendance-table">
            <thead><tr><th>ATTENDANCE</th><th>DAYS</th></tr></thead>
            <tbody>
              <tr><td>TOTAL WORKING DAYS</td><td>${escapeHtml(attendance.workingDays)}</td></tr>
              <tr><td>${scope === 'term' ? 'Present' : 'PRESENT'}</td><td>${escapeHtml(attendance.present)}</td></tr>
              <tr><td>${scope === 'term' ? 'Absent' : 'ABSENT'}</td><td>${escapeHtml(attendance.absent)}</td></tr>
              ${scope === 'term' ? `<tr><td>Leave</td><td>${escapeHtml(attendance.leave)}</td></tr>` : ''}
            </tbody>
          </table>
        </section>
        <div class="report-card-side">
          <section class="report-card-panel report-card-average">
            <h3>AVERAGE %</h3>
            <strong>${average === null ? '—' : `${average}%`}</strong>
          </section>
          <section class="report-card-panel report-card-remarks">
            <h3>PRINCIPAL'S REMARKS</h3>
            <textarea class="field-input report-card-remarks-input" rows="3" readonly>${escapeHtml(reportCardRemark(average, scope))}</textarea>
          </section>
        </div>
      </div>
      <section class="report-card-panel report-card-graph-panel">
        <div class="report-card-graph-head">
          <div><h3>Subject-Wise Marks Achievement Line Graph</h3>
            <p>Student: <strong>${escapeHtml(student.full_name)}</strong> &nbsp; Class: <strong>${escapeHtml(className(student.class_id))}</strong> &nbsp; Session: <strong>${escapeHtml(scope === 'term' ? session : sessionLabel)}</strong> &nbsp; ${scope === 'term' ? 'Term' : 'Month'}: <strong>${escapeHtml(monthLabel)}</strong></p></div>
          <div class="report-card-legend"><span class="marks">Marks line</span><span class="pass">80% pass</span></div>
        </div>
        ${reportCardGraph(graphPoints, 80, scope !== 'term')}
        <div class="report-card-graph-foot"><span>HIGH ${Math.round(high)}% &nbsp;·&nbsp; AVERAGE ${average === null ? '—' : `${average}%`} &nbsp;·&nbsp; LOW ${Math.round(low)}%</span><span>TREND: ${escapeHtml(trend.toUpperCase())}</span></div>
      </section>
      <footer class="report-card-signatures">
        <div><span></span><strong>Class Teacher Signature</strong></div>
        <div><span></span><strong>Principal Signature</strong></div>
      </footer>
    </article>`;
  };

  // __REPORT_CARD_CONTINUE__

  const reportCardStudents = () => {
    const permitted = new Set(permittedStudents());
    return records('students')
      .filter(student => permitted.has(student.id))
      .filter(student => !state.reportCardClass || student.class_id === state.reportCardClass)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  };

  const reportCardPermittedStudents = () => {
    const permitted = new Set(permittedStudents());
    return records('students').filter(student => permitted.has(student.id));
  };

  const reportCardsView = () => {
    const scope = state.reportCardScope === 'term' ? 'term' : 'monthly';
    const months = reportCardMonths();
    const students = reportCardStudents();
    const classOptions = records('classes')
      .filter(row => reportCardPermittedStudents().some(student => student.class_id === row.id) || isManager());
    if (!state.reportCardClass && classOptions.length === 1) state.reportCardClass = classOptions[0].id;
    if (state.reportCardStudentId && !students.some(student => student.id === state.reportCardStudentId)) {
      state.reportCardStudentId = '';
    }
    if (!state.reportCardStudentId && students.length) state.reportCardStudentId = students[0].id;
    const student = students.find(row => row.id === state.reportCardStudentId);
    if (!state.reportCardMonth && months.length) state.reportCardMonth = String(months[0].month);
    const monthOptions = months.map(item => `<option value="${item.month}" ${Number(state.reportCardMonth) === item.month ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
    const scopeToggle = `<div class="report-card-scope" role="group" aria-label="Report period">
      <button type="button" class="button button-small ${scope === 'monthly' ? 'button-primary' : 'button-outline'}" data-report-card-scope="monthly">Monthly report</button>
      <button type="button" class="button button-small ${scope === 'term' ? 'button-primary' : 'button-outline'}" data-report-card-scope="term">Term report</button>
    </div>`;
    const toolbar = `<section class="report-card-toolbar">
      ${scopeToggle}
      <label class="field-label">Class<select class="field-select" data-report-card-class><option value="">All classes</option>${classOptions.map(row => `<option value="${escapeHtml(row.id)}" ${row.id === state.reportCardClass ? 'selected' : ''}>${escapeHtml(row.name)}</option>`).join('')}</select></label>
      <label class="field-label">Student<select class="field-select" data-report-card-student><option value="">Select a student</option>${students.map(row => `<option value="${escapeHtml(row.id)}" ${row.id === state.reportCardStudentId ? 'selected' : ''}>${escapeHtml(row.full_name)} · ${escapeHtml(className(row.class_id))}</option>`).join('')}</select></label>
      <label class="field-label">Term<select class="field-select" data-report-card-term><option value="1st Term" ${normalizedTerm(state.reportCardTerm) === '1st Term' ? 'selected' : ''}>1st Term</option><option value="2nd Term" ${normalizedTerm(state.reportCardTerm) === '2nd Term' ? 'selected' : ''}>2nd Term</option></select></label>
      ${scope === 'monthly' ? `<label class="field-label">Month<select class="field-select" data-report-card-month>${monthOptions}</select></label>` : ''}
      <div class="report-card-toolbar-actions">
        <button type="button" class="button button-outline button-small" data-print-report-card>${scope === 'term' ? 'Print term report' : 'Print monthly report'}</button>
        <button type="button" class="button button-primary button-small" data-report-card-pdf>Save as PDF</button>
      </div>
    </section>`;
    const body = student
      ? reportCardSheet(student, scope)
      : '<div class="empty-state"><strong>No student selected</strong>Choose a class and student to generate a report card.</div>';
    return `${pageHeading('REPORT CARDS', 'Progress reports', 'Monthly and term progress reports ready to print or export.', '')}
      ${toolbar}
      <div class="report-card-stage">${body}</div>`;
  };

  const schoolSettingsView = () => {
    const school = currentSchool();
    const logo = school.logo_preview || state.imageUrls[school.logo_path] || '';
    return `${pageHeading('SCHOOL PROFILE', 'School settings', 'Update your school name and logo.', '')}
      <section class="panel"><header class="panel-header"><div><h2>School identity</h2><p>The logo appears in the school workspace.</p></div></header>
        <form id="schoolSettingsForm" class="panel-body dialog-fields">
          ${field('school_name', 'School name', 'text', SCHOOL_NAME, null, true, true)}
           ${field('academic_year', 'Academic session (year)', 'text', school.academic_year || '', null, true, true)}
          ${imageField('logo_file', 'School logo', logo, true)}
          <div class="full-field"><button class="button button-primary" type="submit">Save school settings</button></div>
        </form>
      </section>`;
  };

  const brandingView = () => {
    const b = window.SEEDS_BRANDING ? window.SEEDS_BRANDING.get() : { labels: {}, fonts: { nav: 1, heading: 1, column: 1 } };
    const defaults = window.SEEDS_LABEL_DEFAULTS || {};
    const keys = Object.keys(defaults).sort((a, c) => a.localeCompare(c));
    const rows = keys.map(k => {
      const cur = (b.labels && b.labels[k]) ? b.labels[k] : '';
      return `<div class="branding-row">
        <label class="branding-default">${escapeHtml(k)}</label>
        <input class="branding-input" data-brand-key="${escapeHtml(k)}" type="text" value="${escapeHtml(cur)}" placeholder="${escapeHtml(defaults[k])}">
      </div>`;
    }).join('');
    return `${pageHeading('BRANDING', 'Branding & labels', 'Customize headings, button names, column headings, and left-panel names. Empty value keeps the default.', '')}
      <section class="panel">
        <header class="panel-header"><div><h2>Font sizes</h2><p>Increase the font size of left-panel names, headings, and column headings.</p></div></header>
        <div class="panel-body dialog-fields">
          <label class="field-label">Left panel names <input id="brandFontNav" type="range" min="0.8" max="1.6" step="0.05" value="${b.fonts.nav}"><span id="brandFontNavVal">${b.fonts.nav}</span></label>
          <label class="field-label">Headings <input id="brandFontHeading" type="range" min="0.8" max="1.6" step="0.05" value="${b.fonts.heading}"><span id="brandFontHeadingVal">${b.fonts.heading}</span></label>
          <label class="field-label">Column headings <input id="brandFontColumn" type="range" min="0.8" max="1.6" step="0.05" value="${b.fonts.column}"><span id="brandFontColumnVal">${b.fonts.column}</span></label>
        </div>
      </section>
      <section class="panel" style="margin-top:16px">
        <header class="panel-header"><div><h2>Label overrides</h2><p>Type a new name to override a default. Leave blank to keep the default.</p></div>
        <div class="panel-body">
          <input id="brandingSearch" class="table-search" type="search" placeholder="Search labels…" aria-label="Search labels">
          <div id="brandingList" class="branding-list">${rows}</div>
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="button button-primary" id="brandingSaveButton" type="button">Save branding</button>
            <button class="button button-outline" id="brandingResetButton" type="button">Reset all to defaults</button>
          </div>
        </div>
      </section>`;
  };


  const creditView = () => {
    const credit = state.developerCredit || defaultDeveloperCredit();
    const photo = credit.photo || '';
    const links = credit.links || [];
    const isDev = state.profile?.role === 'developer';
    return `${pageHeading('DEVELOPER CREDIT', 'About the developer', 'Credits and projects by the platform developer.', '')}
      <section class="panel">
        <header class="panel-header"><div><h2>${escapeHtml(credit.name || 'Developer')}</h2><p>${escapeHtml(credit.bio || '')}</p></div></header>
        <div class="panel-body">
          ${photo ? `<img class="image-preview" src="${escapeHtml(photo)}" alt="Developer photo" style="max-width:220px;border-radius:16px;margin-bottom:12px;">` : ''}
          <h3>Projects</h3>
          ${links.length ? `<ul class="developer-links">${links.map(link => `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.title || link.url)}</a></li>`).join('')}</ul>` : '<div class="empty-state">No projects listed yet.</div>'}
        </div>
      </section>
      ${isDev ? `<section class="panel" style="margin-top:16px">
        <header class="panel-header"><div><h2>Manage credit page</h2><p>Update your name, bio, photo, and project links.</p></div></header>
        <form id="developerCreditForm" class="panel-body dialog-fields">
          ${field('credit_name', 'Name', 'text', credit.name, null, true, true)}
          ${field('credit_bio', 'Experience / bio', 'textarea', credit.bio, null, false, true)}
          ${imageField('credit_photo', 'Developer photo', photo, false)}
          ${field('credit_links', 'Project links (one per line: Title | URL)', 'textarea', links.map(link => `${link.title || ''} | ${link.url || ''}`).join('\n'), null, false, true)}
          <div class="full-field"><button class="button button-primary" type="submit">Save credit page</button></div>
        </form>
      </section>` : ''}`;
  };

  const homeworkView = () => {
    const role = state.profile?.role;
    const canManage = ['developer', 'admin', 'teacher'].includes(role);
    const childStudentIds = role === 'parent'
      ? records('parent_students').filter(ps => ps.parent_profile_id === state.user?.id).map(ps => ps.student_id)
      : [];
    const childClasses = records('students').filter(s => childStudentIds.includes(s.id)).map(s => s.class_id);
    const myStudent = role === 'student' ? records('students').find(s => s.id === state.profile?.student_id) : null;
    const visibleDiaries = records('homework_diaries').slice()
      .filter(d => {
        if (canManage) return true;
        if (role === 'student') return d.class_id === myStudent?.class_id;
        if (role === 'parent') return childClasses.includes(d.class_id);
        return false;
      })
      .sort((a, b) => String(b.homework_date || '').localeCompare(String(a.homework_date || '')));
    const receiptSet = new Set(records('homework_receipts').map(r => `${r.homework_id}:${r.student_id}`));
    const teacherOptions = optionList(records('teachers'), 'full_name', 'Choose teacher');
    const defaultTeacher = state.profile?.teacher_id || records('teachers')[0]?.id || '';
    const publicUrl = path => `${supabaseUrl}/storage/v1/object/public/school-media/${String(path || '').split('/').map(encodeURIComponent).join('/')}`;
    const manageForm = canManage ? `<section class="panel">
      <header class="panel-header"><div><h2>Create homework diary</h2><p>Add homework details.</p></div></header>
      <form id="homeworkDiaryForm" class="panel-body dialog-fields">
        ${field('homework_class_id', 'Class', 'select', '', optionList(records('classes'), 'name', 'Choose class'), true, true)}
        ${field('homework_subject_id', 'Subject', 'select', '', optionList(records('subjects'), 'name', 'Choose subject'), true, true)}
        ${field('homework_teacher_id', 'Teacher', 'select', defaultTeacher, teacherOptions, true, true)}
        ${field('homework_date', 'Date', 'date', todayISO(), null, true, true)}
        ${field('homework_topic', 'Topic', 'text', '', null, true, true)}
        ${field('homework_content', 'Homework text (Urdu / English)', 'textarea', '', null, false, true)}
        <div class="full-field" style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="button button-outline button-small" data-homework-voice="ur-PK">Dictate (Urdu)</button>
          <button type="button" class="button button-outline button-small" data-homework-voice="en-US">Dictate (English)</button>
          <button type="button" class="button button-outline button-small" id="homeworkRecordBtn">Record audio</button>
          <span id="homeworkRecordStatus" class="field-hint"></span>
        </div>
        <label class="field-label full-field">Images<input class="field-input" type="file" name="homework_images" accept="image/jpeg,image/png,image/webp" multiple></label>
        <label class="field-label full-field">Audio file<input class="field-input" type="file" name="homework_audio" accept="audio/*"></label>
        <div class="full-field"><button class="button button-primary" type="submit">Save homework diary</button></div>
      </form>
    </section>` : '';
    const entries = visibleDiaries.length ? visibleDiaries.map(diary => {
      const images = (diary.image_paths || []).map(path => `<img class="image-preview" src="${escapeHtml(publicUrl(path))}" alt="Homework image" style="max-width:180px;border-radius:12px;margin:6px;">`).join('');
      const audio = diary.audio_path ? `<audio controls src="${escapeHtml(publicUrl(diary.audio_path))}" style="margin-top:8px;width:100%"></audio>` : '';
      let receiptHtml = '';
      if (role === 'parent') {
        const relevantChildren = records('students').filter(s => childStudentIds.includes(s.id) && s.class_id === diary.class_id);
        receiptHtml = relevantChildren.map(student => {
          const done = receiptSet.has(`${diary.id}:${student.id}`);
          return done
            ? `<span class="status-pill">Received · ${escapeHtml(student.full_name)}</span>`
            : `<button class="button button-outline button-small" data-action="confirm-homework" data-homework-id="${escapeHtml(diary.id)}" data-student-id="${escapeHtml(student.id)}">Mark received · ${escapeHtml(student.full_name)}</button>`;
        }).join(' ');
      } else if (canManage) {
        const count = records('homework_receipts').filter(r => r.homework_id === diary.id).length;
        const classStudents = records('students').filter(s => s.class_id === diary.class_id);
        receiptHtml = `<small>${count} of ${classStudents.length} parents confirmed receipt</small>`;
      }
      return `<article class="panel" style="margin-bottom:14px">
        <header class="panel-header"><div><h3>${escapeHtml(diary.topic || 'Homework')}</h3><p>${escapeHtml(subjectName(diary.subject_id))} · ${escapeHtml(className(diary.class_id))} · ${escapeHtml(teacherName(diary.teacher_id))} · ${escapeHtml(diary.homework_date || '')}</p></div></header>
        <div class="panel-body">
          <p style="white-space:pre-wrap;margin:0 0 10px">${escapeHtml(diary.content || '')}</p>
          ${images ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">${images}</div>` : ''}
          ${audio}
          ${receiptHtml ? `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${receiptHtml}</div>` : ''}
        </div>
      </article>`;
    }).join('') : '<div class="empty-state">No homework diary entries yet.</div>';
    return `${pageHeading('HOMEWORK DIARY', 'Homework diary', 'Homework entries.', '')}
      ${manageForm}
      <section class="panel">
        <header class="panel-header"><div><h2>Entries</h2><p>${visibleDiaries.length} item${visibleDiaries.length === 1 ? '' : 's'}</p></div></header>
        <div class="panel-body">${entries}</div>
      </section>`;
  };

  const accountsView = () => {
    const accountRows = state.accounts.map(account => `<tr><td>${escapeHtml(account.display_name)}</td><td>${escapeHtml(account.mobile || account.phone || 'Mobile unavailable')}</td><td>${escapeHtml(roleNames[account.role] || account.role)}</td><td>${escapeHtml(records('schools').find(school => school.id === account.school_id)?.name || 'School')}</td><td><button class="text-button danger-text" data-action="delete-account" data-id="${escapeHtml(account.id)}">Remove login</button></td></tr>`).join('');
    return `${pageHeading('ACCESS CONTROL', 'User accounts', 'Self-registered and managed accounts. Visible to the developer only.', '')}
      <div class="callout"><strong>Mobile number sign-in</strong> · Users sign in with their Pakistani mobile number.</div>
      <section class="panel"><header class="panel-header"><div><h2>Create teacher or parent account</h2><p>Credentials are created by the protected Supabase function, never in this browser database.</p></div></header>
        <form id="createAccountForm" class="panel-body dialog-fields">
          ${field('role', 'Account type', 'select', 'teacher', [{ value: 'developer', label: 'Developer' }, { value: 'admin', label: 'Administrator' }, { value: 'teacher', label: 'Teacher' }, { value: 'parent', label: 'Parent / guardian' }, { value: 'student', label: 'Student' }], true)}
          ${field('display_name', 'Full name', 'text', '', null, true)}
          ${field('mobile', 'Pakistani mobile number', 'text', '', null, true)}
          ${field('teacher_id', 'Teacher profile', 'select', '', optionList(records('teachers'), 'full_name', 'Choose teacher'))}
          <label class="field-label">Parent's linked students<select class="field-select" name="student_ids" multiple size="5">${records('students').map(student => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.full_name)} · ${escapeHtml(className(student.class_id))}</option>`).join('')}</select><small>For parent accounts, select one or more children. Hold Ctrl to select multiple.</small></label>
          <div class="full-field"><button class="button button-primary" type="submit">Create account</button></div>
        </form>
      </section>
      <section class="panel" style="margin-top:16px"><header class="panel-header"><div><h2>Teacher and parent accounts</h2><p>Set a new individual password when a user needs a reset.</p></div></header><div class="panel-body">
        ${state.accountsLoaded && !accountRows ? '<div class="empty-state">No teacher or parent accounts are linked yet.</div>' : `<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>School</th><th>Set new password</th></tr></thead><tbody>${accountRows || '<tr><td colspan="5">Loading accounts…</td></tr>'}</tbody></table></div>`}
      </div></section>`;
  };

  const manageAccounts = async payload => {
    const response = await fetch(`${supabaseUrl}/functions/v1/manage-account`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Account management failed (${response.status}).`);
    return result;
  };
  const registerAccount = async ({ mobile, full_name, role }) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/register-account`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, full_name, role, school_id: state.currentSchoolId || null })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Account creation failed (${response.status}).`);
    return result;
  };

  const loadAccounts = async () => {
    if (state.mode !== 'live' || state.profile.role !== 'developer') return;
    state.accountsLoaded = false;
    try {
      const result = await manageAccounts({ action: 'list' });
      state.accounts = result.accounts;
      state.accountsLoaded = true;
      if (state.view === 'accounts') pageContent.innerHTML = accountsView();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not load user accounts.', true);
    }
  };

const sessionView = () => {
  const school = currentSchool();
  const canManage = isManager();
  const nextYear = String((Number(school.academic_year) || new Date().getFullYear()) + 1);
  const classOptions = records('classes').map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  return `${pageHeading('SESSION & PROMOTION', 'Session & promotion', 'Start a new academic session and promote students to their next class.', '')}
    ${canManage ? `<section class="panel"><header class="panel-header"><div><h2>Start new session</h2><p>Update the academic session used across attendance, assessments, and reports.</p></div></header><div class="panel-body"><form id="newSessionForm" class="dialog-fields">
      ${field('session_year', 'New academic session (year)', 'text', nextYear, null, true, true)}
      <label class="field-label full-field"><input type="checkbox" name="promote_students" value="1"> Promote all active students to their next class while starting this session</label>
      <div class="full-field"><button class="button button-primary" type="submit">Start new session</button></div>
    </form></div></section>` : ''}
    ${canManage ? `<section class="panel" style="margin-top:16px"><header class="panel-header"><div><h2>Promote students</h2><p>Move a class roster to the next class after the second-term result.</p></div></header><div class="panel-body dialog-fields">
      <label class="field-label">From class<select class="field-select" id="promotionSourceClass">${classOptions}</select></label>
      <label class="field-label">To class<select class="field-select" id="promotionTargetClass">${classOptions}</select></label>
      <div class="full-field" style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="button button-outline" data-action="create-next-class">Create next class</button>
        <button type="button" class="button button-primary" data-action="promote-students">Promote students</button>
      </div>
      <p class="form-message" id="promotionStatus"></p>
    </div></section>` : '<div class="empty-state">Only administrators and developers can manage sessions.</div>'}`;
};

const startNewSession = async event => {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const year = String(formData.get('session_year') || '').trim();
  const promote = formData.get('promote_students') === '1';
  if (!/^\d{4}$/.test(year)) {
    showToast('Enter a valid 4-digit academic session year.', true);
    return;
  }
  try {
    await api(`schools?id=eq.${encodeURIComponent(state.currentSchoolId)}`, { method: 'PATCH', body: { academic_year: year }, prefer: 'return=minimal' });
    if (promote) {
      for (const source of [...records('classes')]) {
        const students = records('students').filter(student => student.class_id === source.id && student.status === 'Active');
        if (!students.length) continue;
        const nextGrade = String(Number(source.grade) + 1);
        if (!Number.isFinite(Number(source.grade))) continue;
        let target = records('classes').find(item => String(item.grade) === nextGrade && item.section === source.section);
        if (!target) {
          const saved = await api('classes', { method: 'POST', body: { school_id: state.currentSchoolId, grade: nextGrade, section: source.section }, prefer: 'return=representation' });
          target = saved?.[0];
          await refreshData();
        }
        for (const student of students) {
          await api(`students?id=eq.${encodeURIComponent(student.id)}`, { method: 'PATCH', body: { class_id: target.id }, prefer: 'return=minimal' });
        }
      }
      await refreshData();
    } else {
      await refreshData();
    }
    syncSchoolIdentity();
    goToView('session');
    showToast('New academic session started.');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not start the new session.', true);
  }
};

const createNextClass = async () => {
  const source = records('classes').find(item => item.id === $('#promotionSourceClass')?.value);
  if (!source) throw new Error('Choose a source class.');
  const nextGrade = String(Number(source.grade) + 1);
  await api('classes', { method: 'POST', body: { school_id: state.currentSchoolId, grade: nextGrade, section: source.section }, prefer: 'return=representation' });
  await refreshData();
  goToView('session');
  showToast('Next class created.');
};

const promoteStudents = async () => {
  const sourceId = $('#promotionSourceClass')?.value;
  const targetId = $('#promotionTargetClass')?.value;
  if (!sourceId || !targetId || sourceId === targetId) throw new Error('Choose different source and target classes.');
  const students = records('students').filter(student => student.class_id === sourceId && student.status === 'Active');
  if (!students.length) {
    showToast('No active students in the selected source class.', true);
    return;
  }
  for (const student of students) {
    await api(`students?id=eq.${encodeURIComponent(student.id)}`, { method: 'PATCH', body: { class_id: targetId }, prefer: 'return=minimal' });
  }
  await refreshData();
  goToView('session');
  showToast(`Promoted ${students.length} students.`);
};



const remindersView = () => {
  const canManage = isManager();
  const appLink = window.location.href.split('#')[0];
  const today = todayISO();
  const currentMonth = today.slice(5, 7);
  const currentYear = today.slice(0, 4);
  const deadlinePassed = true; // Always check based on local time; remove Pakistan time constraint
  const missingByTeacher = new Map();
  const addPending = (teacherId, item) => {
    if (!teacherId) return;
    if (!missingByTeacher.has(teacherId)) missingByTeacher.set(teacherId, new Set());
    missingByTeacher.get(teacherId).add(item);
  };
  for (const assignment of records('class_subjects')) {
    const hasClassAttendance = records('attendance').some(row => row.attendance_date === today && row.class_id === assignment.class_id);
    const hasSubjectAttendance = records('subject_attendance').some(row => row.attendance_date === today && row.class_id === assignment.class_id && row.subject_id === assignment.subject_id);
    if (!hasClassAttendance && !hasSubjectAttendance) {
      addPending(assignment.teacher_id, `Daily attendance not saved for ${className(assignment.class_id)} · ${subjectName(assignment.subject_id)}`);
    }
  }
  for (const assessment of records('assessments')) {
    if (assessment.assessment_type !== 'Monthly test') continue;
    if (String(assessment.assessment_date || '').slice(5, 7) !== currentMonth || String(assessment.assessment_date || '').slice(0, 4) !== currentYear) continue;
    const assignment = records('class_subjects').find(row => row.class_id === assessment.class_id && row.subject_id === assessment.subject_id);
    const enrolled = records('subject_enrollments').filter(row => row.assignment_id === assignment?.id).map(row => row.student_id);
    const marks = records('marks').filter(row => row.assessment_id === assessment.id);
    const filled = marks.filter(row => row.score !== null && row.score !== undefined && String(row.score).trim() !== '').length;
    if (filled < (enrolled.length || 1)) {
      addPending(assignment?.teacher_id, `Monthly test marks pending for ${className(assessment.class_id)} · ${subjectName(assessment.subject_id)} (${assessment.title})`);
    }
  }
  if (deadlinePassed) {
    const todayDay = pakistanDayName(today);
    for (const [classKey, days] of Object.entries(HOMEWORK_SCHEDULE)) {
      const subjects = days[todayDay] || [];
      const klass = findClassByName(classKey);
      if (!klass) continue;
      for (const rawSubject of subjects) {
        for (const subjectNamePart of splitHomeworkSubjects(rawSubject)) {
          const subject = findSubjectByName(subjectNamePart);
          if (!subject) continue;
          const hasHomework = records('homework_diaries').some(row =>
            row.class_id === klass.id && row.subject_id === subject.id && String(row.homework_date || '') === today);
          if (hasHomework) continue;
          const assignment = records('class_subjects').find(row => row.class_id === klass.id && row.subject_id === subject.id);
          addPending(assignment?.teacher_id, `Homework not saved before 2:00 PM for ${className(klass.id)} · ${subjectName(subject.id)}`);
        }
      }
    }
  }
  const rows = [...missingByTeacher.entries()].map(([teacherId, items]) => {
    const teacher = records('teachers').find(row => row.id === teacherId);
    if (!teacher) return '';
    const phone = normalizeMobile(teacher.phone || '');
    const pending = [...items].join('; ');
    const homeworkLink = `${appLink} (open Homework diary)`;
    const message = `Assalam o Alaikum ${teacher.full_name}. Pending items: ${pending}. Please also send homework from the app: ${appLink}. Homework area: ${homeworkLink}.`;
    const whatsapp = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';
    return `<tr>
      <td><strong>${escapeHtml(teacher.full_name)}</strong><small>${escapeHtml(teacher.phone || 'No phone')}</small></td>
      <td>${escapeHtml(pending)}</td>
      <td>${whatsapp ? `<a class="button button-outline button-small" href="${escapeHtml(whatsapp)}" target="_blank" rel="noopener">Send WhatsApp</a>` : '<span class="status-pill">No phone</span>'}</td>
    </tr>`;
  }).filter(Boolean);
  const deadlineNote = deadlinePassed
    ? 'Homework reminders include classes whose scheduled subjects were not saved before 2:00 PM Pakistan time.'
    : 'Homework reminders will be generated after 2:00 PM Pakistan time for scheduled subjects without a saved homework diary.';
  return `${pageHeading('TEACHER REMINDERS', 'Teacher reminders', 'WhatsApp reminders for teachers with pending attendance, monthly-test marks, or unsaved homework.', '')}
    ${!canManage ? '<div class="empty-state">Only administrators and developers can send reminders.</div>' : `
      <div class="callout"><strong>Automatic reminders</strong> · ${escapeHtml(deadlineNote)} Links open WhatsApp with a pre-filled message, app link, and homework area reference.</div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Teacher</th><th>Pending items</th><th>WhatsApp</th></tr></thead><tbody>${rows.length ? rows.join('') : '<tr><td colspan="3"><div class="empty-state">No pending teacher reminders.</div></td></tr>'}</tbody></table></div>`}`;
};


  const goToView = view => {
    if (!labels[view]) return;
    state.view = view;
    $('#breadcrumbTitle').textContent = labels[view];
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('selected', button.dataset.view === view));
  const views = {
      overview: overviewView,
      students: () => directoryView('students', 'Student directory', 'Every learner, organized in one place.', 'Add student'),
      teachers: () => directoryView('teachers', 'Teaching staff', 'Faculty profiles and school contact information.', 'Add teacher'),
      academics: classesAndSubjectsView,
      attendance: attendanceView,
      assessments: assessmentsView,
      reports: reportsView,
      reportcards: reportCardsView,
      accounts: accountsView,
      school: schoolSettingsView,
       branding: brandingView,
      credit: creditView,
      homework: homeworkView
    };
    if (typeof sessionView === 'function') views.session = sessionView;
    if (typeof remindersView === 'function') views.reminders = remindersView;
    const renderView = views[view];
    if (typeof renderView !== 'function') {
      pageContent.innerHTML = '<div class="empty-state"><strong>This section is unavailable</strong>The requested workspace view could not be loaded.</div>';
      return;
    }
    try {
      pageContent.innerHTML = renderView();
    } catch (error) {
      console.error('View render error:', error);
      pageContent.innerHTML = `<div class="empty-state"><strong>Could not load this section</strong>${escapeHtml(error instanceof Error ? error.message : 'Unexpected error while rendering the page.')}</div>`;
      showToast(error instanceof Error ? error.message : 'Could not load this section.', true);
    }
    $('#navStudentCount').textContent = state.data.students.length;
    if (view === 'accounts') loadAccounts();
  };

  const optionList = (rows, labelKey, placeholder) => [
    { value: '', label: placeholder },
    ...rows.map(row => ({ value: row.id, label: row[labelKey] }))
  ];

  const field = (name, label, type = 'text', value = '', options = null, required = false, full = false) => {
    const klass = full ? 'field-label full-field' : 'field-label';
    const safeValue = escapeHtml(value);
    let control;
    if (type === 'select') {
      control = `<select class="field-select" name="${name}" ${required ? 'required' : ''}>${(options || []).map(item => `<option value="${escapeHtml(item.value)}" ${String(item.value) === String(value) ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select>`;
    } else if (type === 'textarea') {
      control = `<textarea class="field-input" name="${name}" rows="3" ${required ? 'required' : ''}>${safeValue}</textarea>`;
    } else {
      control = `<input class="field-input" name="${name}" type="${type}" value="${safeValue}" ${required ? 'required' : ''} ${type === 'number' ? 'min="0"' : ''}>`;
    }
    return `<label class="${klass}">${escapeHtml(label)}${control}</label>`;
  };

  const imageField = (name, label, value, logo = false, passport = false, side = false) => `
    <label class="field-label ${side ? 'student-photo-field' : 'full-field'}">${escapeHtml(label)}
      <img class="image-preview ${logo ? 'logo-preview' : ''} ${passport ? 'passport-preview' : ''}" data-preview-for="${name}" src="${escapeHtml(value || '')}" alt="Current ${escapeHtml(label.toLowerCase())}" ${value ? '' : 'hidden'}>
      <input class="field-input image-upload" type="file" name="${name}" accept="image/jpeg,image/png,image/webp" aria-label="${escapeHtml(label)}">
      <small>Choose an image from your device · JPG, PNG, or WEBP · maximum 5 MB${value ? ' · choose a file to replace the current image' : ''}</small>
    </label>`;

  const customFieldRow = (key = '', value = '') => `
    <div class="custom-field-row" data-custom-field-row>
      <input class="field-input" data-custom-field-key type="text" value="${escapeHtml(key)}" placeholder="Field name" aria-label="Custom field name">
      <input class="field-input" data-custom-field-value type="text" value="${escapeHtml(value)}" placeholder="Value" aria-label="Custom field value">
      <button type="button" class="icon-button custom-field-remove" data-remove-custom-field aria-label="Remove field">×</button>
    </div>`;

  const customFieldsEditor = (row = {}) => {
    const entries = Object.entries(row?.extra_fields || {});
    return `<div class="full-field custom-fields-editor" data-custom-fields-editor>
      <div class="custom-fields-head">
        <div><strong>Additional fields</strong><small>Add any extra information needed for this profile.</small></div>
        <button type="button" class="button button-outline button-small" data-add-custom-field>Add field</button>
      </div>
      <div class="custom-fields-list">
        ${entries.length ? entries.map(([key, value]) => customFieldRow(key, value)).join('') : ''}
      </div>
    </div>`;
  };

  const defaultAssessmentDate = (term, type, assignmentId = state.assessmentAssignmentId, excludeId = '') => {
    const normalized = normalizedTerm(term);
    const baseYear = Number(currentSchool().academic_year) || new Date().getFullYear();
    const year = normalized === '2nd Term' ? baseYear + 1 : baseYear;
    if (type === 'Monthly test') {
      const assignment = records('class_subjects').find(row => row.id === assignmentId);
      const existingMonths = new Set(records('assessments')
        .filter(row => row.id !== excludeId &&
          row.class_id === assignment?.class_id &&
          row.subject_id === assignment?.subject_id &&
          normalizedTerm(row.term) === normalized &&
          row.assessment_type === 'Monthly test')
        .map(row => Number(String(row.assessment_date || '').slice(5, 7))));
      const month = termMonths[normalized].find(item => !existingMonths.has(item.month)) || termMonths[normalized][0];
      return `${year}-${String(month.month).padStart(2, '0')}-08`;
    }
    return normalized === '2nd Term' ? `${year}-05-18` : `${year}-12-18`;
  };

  const formDefinitions = {
    students: {
      title: 'Student', fields: (row = {}) => [
        imageField('photo_file', 'Student picture', imageSrc(row), false, true, true),
        field('full_name', 'Full name', 'text', row.full_name, null, true),
        field('gender', 'Gender', 'select', row.gender || '', [{ value: '', label: 'Select gender' }, ...['Female', 'Male', 'Other'].map(value => ({ value, label: value }))]),
        field('class_id', 'Class', 'select', row.class_id || '', optionList(records('classes'), 'name', 'Select class'), true),
        field('roll_number', 'Roll number', 'text', row.roll_number),
        field('guardian_name', 'Parent / guardian', 'text', row.guardian_name),
        field('guardian_phone', 'Guardian phone', 'tel', row.guardian_phone),
        field('status', 'Status', 'select', row.status || 'Active', ['Active', 'Inactive'].map(value => ({ value, label: value }))),
        customFieldsEditor(row)
      ]
    },
    teachers: {
      title: 'Teacher', fields: (row = {}) => [
        imageField('photo_file', 'Teacher picture', imageSrc(row)),
        field('full_name', 'Full name', 'text', row.full_name, null, true),
        field('email', 'Email address', 'email', row.email),
        field('phone', 'Phone number', 'tel', row.phone),
        field('status', 'Status', 'select', row.status || 'Active', ['Active', 'Inactive'].map(value => ({ value, label: value }))),
        customFieldsEditor(row)
      ]
    },
    classes: {
      title: 'Class', fields: (row = {}) => [
        field('grade', 'Grade', 'text', row.grade, null, true),
        field('section', 'Section', 'text', row.section, null, true)
      ]
    },
    subjects: {
      title: 'Subject', fields: (row = {}) => [
        field('name', 'Subject name', 'text', row.name, null, true),
        field('code', 'Subject code', 'text', row.code)
      ]
    },
    class_subjects: {
      title: 'Teaching assignment', fields: row => [
        field('class_id', 'Class', 'select', row?.class_id || '', optionList(records('classes'), 'name', 'Select class'), true),
        field('subject_id', 'Subject', 'select', row?.subject_id || '', optionList(records('subjects'), 'name', 'Select subject'), true),
        field('teacher_id', 'Teacher', 'select', row?.teacher_id || '', optionList(records('teachers'), 'full_name', 'Select teacher'), true)
      ]
    },
    assessments: {
      title: 'Assessment', fields: (row = {}) => {
        const assigned = records('class_subjects').find(item => item.id === state.assessmentAssignmentId);
        const assignments = records('class_subjects').filter(item =>
          isManager() || (state.profile.role === 'teacher' && item.teacher_id === state.profile.teacher_id));
        const classes = [...new Map(assignments.map(item => {
          const klass = records('classes').find(value => value.id === item.class_id);
          return [klass?.id, klass];
        }).filter(([id, klass]) => id && klass)).values()];
        const selectedClass = row.class_id || assigned?.class_id || classes[0]?.id || '';
        const subjects = assignments.filter(item => item.class_id === selectedClass).map(item =>
          ({ value: item.subject_id, label: subjectName(item.subject_id) }));
        const selectedSubject = row.subject_id || assigned?.subject_id || subjects[0]?.value || '';
        const assessmentTerm = normalizedTerm(row.term || state.assessmentTerm);
        const selectedAssignment = records('class_subjects').find(item =>
          item.class_id === selectedClass && item.subject_id === selectedSubject);
        const configuredMonths = records('assessments').filter(item =>
          item.class_id === selectedClass &&
          item.subject_id === selectedSubject &&
          normalizedTerm(item.term) === assessmentTerm &&
          item.assessment_type === 'Monthly test').length;
        const assessmentType = row.assessment_type || (configuredMonths === 3 ? 'Term exam' : 'Monthly test');
        const assessmentDate = row.assessment_date || defaultAssessmentDate(assessmentTerm, assessmentType, assigned?.id, row.id || '');
        const assessmentTitle = row.title || (assessmentType === 'Monthly test'
          ? termMonths[assessmentTerm].find(month => month.month === Number(assessmentDate.slice(5, 7)))?.label || 'Monthly test'
          : `${assessmentTerm} examination`);
        return [
        field('title', 'Assessment title', 'text', assessmentTitle, null, true),
        field('assessment_type', 'Type', 'select', assessmentType, ['Monthly test', 'Term exam'].map(value => ({ value, label: value })), true),
        field('class_id', 'Class', 'select', selectedClass, optionList(classes, 'name', 'Select class'), true),
        field('subject_id', 'Subject', 'select', selectedSubject, [{ value: '', label: 'Select subject' }, ...subjects], true),
        field('assessment_date', 'Date', 'date', assessmentDate, null, true),
        field('term', 'Term', 'select', assessmentTerm, ['1st Term', '2nd Term'].map(value => ({ value, label: value })), true),
        field('max_marks', 'Maximum marks', 'number', assessmentType === 'Monthly test' ? 20 : row.max_marks || 100, null, true)
      ];
      }
    }
  };

  const openRecordDialog = (table, row = null) => {
    const definition = formDefinitions[table];
    if (!definition) return;
    $('#dialogTitle').textContent = `${row ? 'Edit' : 'Add'} ${definition.title.toLowerCase()}`;
    $('#dialogFields').innerHTML = definition.fields(row || {}).join('');
    const dialog = $('#recordDialog');
    dialog.dataset.table = table;
    dialog.dataset.id = row?.id || '';
    dialog.classList.toggle('student-profile-dialog', table === 'students');
    if (table === 'students' && !row && state.studentDirectoryClass) {
      setTimeout(() => {
        const classField = $('#recordForm')?.elements?.namedItem('class_id');
        if (classField) classField.value = state.studentDirectoryClass;
      }, 0);
    }
    if (table === 'assessments') {
      const form = $('#recordForm');
      const typeField = form.elements.namedItem('assessment_type');
      const maximumField = form.elements.namedItem('max_marks');
      maximumField.readOnly = typeField.value === 'Monthly test';
      if (typeField.value === 'Monthly test') maximumField.value = '20';
    }
    dialog.showModal();
  };

  const makeCsv = () => {
    const header = ['Student ID', 'Student name', 'Class', 'Assessment', 'Subject', 'Score', 'Maximum marks', 'Percentage'];
    const rows = [header, ...permittedMarks().map(mark => {
      const test = records('assessments').find(row => row.id === mark.assessment_id);
      const student = records('students').find(row => row.id === mark.student_id);
      if (!test || !student) return null;
      return [student.student_id, student.full_name, className(student.class_id), test.title, subjectName(test.subject_id), mark.score, test.max_marks, `${Math.round(mark.score / test.max_marks * 100)}%`];
    }).filter(Boolean)];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `seeds-academic-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClick = async event => {
    if (event.target.closest('#brandingSaveButton')) {
      const labels = {};
      document.querySelectorAll('.branding-input').forEach(input => {
        const key = input.dataset.brandKey;
        const val = input.value.trim();
        if (key) labels[key] = val;
      });
      const fonts = {
        nav: Number(document.getElementById('brandFontNav')?.value) || 1,
        heading: Number(document.getElementById('brandFontHeading')?.value) || 1,
        column: Number(document.getElementById('brandFontColumn')?.value) || 1
      };
      if (window.SEEDS_BRANDING) window.SEEDS_BRANDING.save({ labels, fonts });
      applyLabelOverrides(document);
      showToast('Branding saved.');
      return;
    }
    if (event.target.closest('#brandingResetButton')) {
      if (window.SEEDS_BRANDING) window.SEEDS_BRANDING.resetAll();
      goToView('branding');
      showToast('Branding reset to defaults.');
      return;
    }

    const reportCardScopeButton = event.target.closest('[data-report-card-scope]');
    if (reportCardScopeButton) {
      state.reportCardScope = reportCardScopeButton.dataset.reportCardScope;
      goToView('reportcards');
      return;
    }
    if (event.target.closest('[data-print-report-card]')) {
      document.body.classList.add('printing-report-card');
      window.print();
      return;
    }
    if (event.target.closest('[data-report-card-pdf]')) {
      document.body.classList.add('printing-report-card');
      window.print();
      return;
    }
    const termButton = event.target.closest('[data-gradebook-term]');
    if (termButton) {
      state.assessmentTerm = termButton.dataset.gradebookTerm;
      state.assessmentShowBothTerms = false;
      goToView('assessments');
      return;
    }
    if (event.target.closest('[data-gradebook-both]')) {
      state.assessmentShowBothTerms = !state.assessmentShowBothTerms;
      goToView('assessments');
      return;
    }
    if (event.target.closest('[data-gradebook-view-all]')) {
      state.assessmentShowWholeClass = !state.assessmentShowWholeClass;
      goToView('assessments');
      return;
    }
    if (event.target.closest('[data-gradebook-enrollment-toggle]')) {
      state.assessmentEnrollOpen = !state.assessmentEnrollOpen;
      goToView('assessments');
      return;
    }
    if (event.target.closest('[data-save-enrollment]')) {
      try { await saveSubjectEnrollments(); }
      catch (error) { showToast(error instanceof Error ? error.message : 'Could not save subject enrollment.', true); }
      return;
    }
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      goToView(viewButton.dataset.view);
      return;
    }
    const attendanceViewButton = event.target.closest('[data-attendance-view]');
    if (attendanceViewButton) {
      state.attendanceViewMode = attendanceViewButton.dataset.attendanceView;
      goToView('attendance');
      return;
    }
    if (event.target.closest('[data-print-class-strength]')) {
      document.body.classList.add('printing-class-strength');
      window.print();
      return;
    }
    const orientationButton = event.target.closest('[data-print-orientation]');
    if (orientationButton) {
      state.attendancePrintOrientation = orientationButton.dataset.printOrientation;
      goToView('attendance');
      return;
    }
    if (event.target.closest('[data-print-attendance]')) {
      window.print();
      return;
    }
    const statusButton = event.target.closest('[data-student-status]');
    if (statusButton) {
      state.attendanceStatuses[statusButton.dataset.student] = statusButton.dataset.studentStatus;
      goToView('attendance');
      return;
    }
    const batchButton = event.target.closest('[data-batch-status]');
    if (batchButton) {
      for (const student of attendanceStudents()) state.attendanceStatuses[student.id] = batchButton.dataset.batchStatus;
      goToView('attendance');
      showToast(`Marked ${attendanceStudents().length} students ${batchButton.dataset.batchStatus}.`);
      return;
    }
    const dateStep = event.target.closest('[data-date-step]');
    if (dateStep) {
      const date = new Date(`${state.attendanceDate}T12:00:00`);
      date.setDate(date.getDate() + Number(dateStep.dataset.dateStep));
      // Use the date as-is for saving
      state.attendanceDate = date.toISOString().split('T')[0];
      state.attendanceStatuses = {};
      goToView('attendance');
      return;
    }
    const attendanceDateButton = event.target.closest('[data-attendance-date]');
    if (attendanceDateButton) {
      const clickedDate = attendanceDateButton.dataset.attendanceDate;
      const clickedDay = new Date(`${clickedDate}T12:00:00`).getDay();
      if (clickedDay === 0 || clickedDay === 6) {
        showToast(`Off day: ${new Date(`${clickedDate}T12:00:00`).toLocaleDateString('en', { weekday: 'long' })} is a weekend. Attendance cannot be taken on Saturdays or Sundays.`, true);
        return;
      }
      state.attendanceDate = clickedDate;
      state.attendanceRangeStart = state.attendanceDate;
      state.attendanceRangeEnd = state.attendanceDate;
      state.attendanceStatuses = {};
      goToView('attendance');
      return;
    }
    const calendarMonthButton = event.target.closest('[data-calendar-month]');
    if (calendarMonthButton) {
      const current = new Date(`${state.attendanceDate}T12:00:00`);
      const targetMonthIndex = current.getMonth() + Number(calendarMonthButton.dataset.calendarMonth);
      const targetYear = current.getFullYear() + Math.floor(targetMonthIndex / 12);
      const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
      const maxDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const day = Math.min(current.getDate() || 1, maxDay);
      const next = new Date(targetYear, normalizedMonth, day, 12);
      // Use the date as-is for saving
      state.attendanceDate = next.toISOString().split('T')[0];
      state.attendanceRangeStart = state.attendanceDate;
      state.attendanceRangeEnd = state.attendanceDate;
      state.attendanceStatuses = {};
      goToView('attendance');
      return;
    }
    const homeworkVoiceButton = event.target.closest('[data-homework-voice]');
    if (homeworkVoiceButton) {
      startHomeworkVoice(homeworkVoiceButton.dataset.homeworkVoice);
      return;
    }
    if (event.target.closest('#homeworkRecordBtn')) {
      toggleHomeworkRecording();
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, table, id } = button.dataset;
    try {
      if (action === 'add') openRecordDialog(table);
       if (action === 'create-next-class') {
         try { await createNextClass(); }
         catch (error) { showToast(error instanceof Error ? error.message : 'Could not create the next class.', true); }
         return;
       }
       if (action === 'promote-students') {
         try { await promoteStudents(); }
         catch (error) { showToast(error instanceof Error ? error.message : 'Could not promote students.', true); }
         return;
       }
      if (action === 'select-student-class') {
        const select = $('#studentDirectoryClass');
        state.studentDirectoryClass = select?.value || '';
        goToView('students');
        showToast(state.studentDirectoryClass ? `Class selected: ${className(state.studentDirectoryClass)}` : 'All classes selected.');
        return;
      }
      if (action === 'edit') openRecordDialog(table, records(table).find(row => row.id === id));
      if (action === 'delete') {
        const record = records(table).find(row => row.id === id);
        if (!record || !window.confirm(`Remove ${record.full_name || record.name || record.title || 'this record'}?`)) return;
        await deleteRow(table, id);
        goToView(state.view);
        showToast('Record removed.');
      }
      if (action === 'open-marks') {
        state.activeAssessment = id;
        goToView('assessments');
      }
      if (action === 'export') makeCsv();
      if (action === 'confirm-homework') {
        const homeworkId = button.dataset.homeworkId;
        const studentId = button.dataset.studentId;
        await api('homework_receipts', { method: 'POST', body: {
          school_id: state.currentSchoolId,
          homework_id: homeworkId,
          student_id: studentId,
          parent_profile_id: state.user?.id || null
        }, prefer: 'return=representation' });
        await refreshData();
        goToView('homework');
        showToast('Homework receipt confirmed.');
      }
      if (action === 'set-password') {
        const input = pageContent.querySelector(`[data-reset-password="${CSS.escape(id)}"]`);
        const password = input?.value || '';
        if (password.length < 12) throw new Error('Choose a temporary password with at least 12 characters.');
        await manageAccounts({ action: 'set-password', user_id: id, password });
        input.value = '';
        showToast('Password updated. Share it with the user privately.');
      }
      if (action === 'delete-account') {
        const account = state.accounts.find(item => item.id === id);
        if (!account || !window.confirm(`Remove the sign-in for ${account.display_name}? Their student or teacher directory record will remain.`)) return;
        await manageAccounts({ action: 'delete-account', user_id: id });
        showToast('Sign-in removed. The directory record remains.');
        await loadAccounts();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not complete this action.', true);
    }
  };

  const resetMonthlyAssessmentDate = form => {
    const typeField = form.elements.namedItem('assessment_type');
    if (typeField.value !== 'Monthly test') return;
    const termField = form.elements.namedItem('term');
    const dateField = form.elements.namedItem('assessment_date');
    const titleField = form.elements.namedItem('title');
    const assignment = records('class_subjects').find(row =>
      row.class_id === form.elements.namedItem('class_id').value &&
      row.subject_id === form.elements.namedItem('subject_id').value);
    dateField.value = defaultAssessmentDate(termField.value, typeField.value, assignment?.id, $('#recordDialog').dataset.id);
    const month = termMonths[normalizedTerm(termField.value)]
      .find(item => item.month === Number(dateField.value.slice(5, 7)));
    const knownMonthTitles = Object.values(termMonths).flat().map(item => item.label);
    if (month && (!titleField.value.trim() || knownMonthTitles.includes(titleField.value.trim()))) {
      titleField.value = month.label;
    }
  };

  const handlePageChange = event => {
    const target = event.target;
    if (target.matches('[data-report-card-class]')) {
      state.reportCardClass = target.value;
      state.reportCardStudentId = '';
      goToView('reportcards');
      return;
    }
    if (target.matches('[data-report-card-student]')) {
      state.reportCardStudentId = target.value;
      goToView('reportcards');
      return;
    }
    if (target.matches('[data-report-card-term]')) {
      state.reportCardTerm = target.value;
      const months = reportCardMonths();
      if (!months.some(item => item.month === Number(state.reportCardMonth))) {
        state.reportCardMonth = months.length ? String(months[0].month) : '';
      }
      goToView('reportcards');
      return;
    }
    if (target.matches('[data-report-card-month]')) {
      state.reportCardMonth = target.value;
      goToView('reportcards');
      return;
    }
    if (target.id === 'absenteeDate') {
      state.absenteeDate = target.value || todayISO();
      goToView('reports');
      return;
    }
    if (target.id === 'studentDirectoryClass') {
      state.studentDirectoryClass = target.value;
      goToView('students');
      return;
    }
    if (event.target.id === 'gradebookClass') {
      const assignment = gradebookAssignments().find(row => row.class_id === event.target.value);
      state.assessmentAssignmentId = assignment?.id || '';
      state.assessmentShowWholeClass = false;
      state.assessmentEnrollOpen = false;
      goToView('assessments');
      return;
    }
    if (event.target.id === 'gradebookSubject') {
      state.assessmentAssignmentId = event.target.value;
      state.assessmentShowWholeClass = false;
      state.assessmentEnrollOpen = false;
      goToView('assessments');
      return;
    }
    if (event.target.form?.id === 'recordForm' && event.target.name === 'class_id' &&
        $('#recordDialog').dataset.table === 'assessments') {
      const assignment = records('class_subjects').find(row =>
        row.class_id === event.target.value &&
        (isManager() || row.teacher_id === state.profile.teacher_id));
      const subjectField = event.target.form.elements.namedItem('subject_id');
      const assignments = records('class_subjects').filter(row =>
        row.class_id === event.target.value &&
        (isManager() || row.teacher_id === state.profile.teacher_id));
      subjectField.innerHTML = assignments.map(row =>
        `<option value="${escapeHtml(row.subject_id)}">${escapeHtml(subjectName(row.subject_id))}</option>`).join('');
      if (assignment) subjectField.value = assignment.subject_id;
      resetMonthlyAssessmentDate(event.target.form);
      return;
    }
    if (event.target.form?.id === 'recordForm' && event.target.name === 'subject_id' &&
        $('#recordDialog').dataset.table === 'assessments') {
      resetMonthlyAssessmentDate(event.target.form);
      return;
    }
    if (event.target.form?.id === 'recordForm' &&
        ['assessment_type', 'term', 'assessment_date'].includes(event.target.name) &&
        $('#recordDialog').dataset.table === 'assessments') {
      const form = event.target.form;
      const typeField = form.elements.namedItem('assessment_type');
      const termField = form.elements.namedItem('term');
      const dateField = form.elements.namedItem('assessment_date');
      const titleField = form.elements.namedItem('title');
      const maximumField = form.elements.namedItem('max_marks');
      const monthNumber = Number(dateField.value.slice(5, 7));
      const monthsForTerm = termMonths[normalizedTerm(termField.value)];
      if (typeField.value === 'Monthly test') {
        maximumField.value = '20';
        maximumField.readOnly = true;
        if (!monthsForTerm.some(month => month.month === monthNumber)) {
          const assignment = records('class_subjects').find(row =>
            row.class_id === form.elements.namedItem('class_id').value &&
            row.subject_id === form.elements.namedItem('subject_id').value);
          dateField.value = defaultAssessmentDate(termField.value, typeField.value, assignment?.id, $('#recordDialog').dataset.id);
        }
        const selectedMonth = monthsForTerm.find(month => month.month === Number(dateField.value.slice(5, 7)));
        const knownMonthTitles = Object.values(termMonths).flat().map(month => month.label);
        if (selectedMonth && (!titleField.value.trim() || knownMonthTitles.includes(titleField.value.trim()))) {
          titleField.value = selectedMonth.label;
        }
      } else {
        maximumField.readOnly = false;
        if (event.target.name === 'assessment_type') {
          if (!maximumField.value || maximumField.value === '20') maximumField.value = '100';
          const assignment = records('class_subjects').find(row =>
            row.class_id === form.elements.namedItem('class_id').value &&
            row.subject_id === form.elements.namedItem('subject_id').value);
          dateField.value = defaultAssessmentDate(termField.value, typeField.value, assignment?.id, $('#recordDialog').dataset.id);
          const knownMonthTitles = Object.values(termMonths).flat().map(month => month.label);
          if (!titleField.value.trim() || knownMonthTitles.includes(titleField.value.trim())) {
            titleField.value = `${normalizedTerm(termField.value)} examination`;
          }
        }
        if (event.target.name === 'term' && !maximumField.value) maximumField.value = '100';
      }
      return;
    }
    if (event.target.id === 'attendanceClass') {
      state.attendanceClass = event.target.value;
      state.attendanceAssignmentId = '';
      state.attendanceStatuses = {};
      goToView('attendance');
      return;
    }
    if (event.target.id === 'attendanceAssignment') {
      const selected = records('class_subjects').find(row => row.id === event.target.value);
      state.attendanceAssignmentId = selected?.id || '';
      if (selected) state.attendanceClass = selected.class_id;
      state.attendanceStatuses = {};
      goToView('attendance');
      return;
    }
    if (event.target.id === 'attendanceDate') {
      state.attendanceDate = event.target.value;
      state.attendanceStatuses = {};
      if (!state.attendanceRangeMode) {
        state.attendanceRangeStart = event.target.value;
        state.attendanceRangeEnd = event.target.value;
      }
      goToView('attendance');
      return;
    }
    if (event.target.id === 'attendanceRangeMode') {
      state.attendanceRangeMode = event.target.checked;
      state.attendanceRangeStart = state.attendanceDate;
      state.attendanceRangeEnd = state.attendanceDate;
      goToView('attendance');
      return;
    }
    if (event.target.id === 'attendanceRangeStart') {
      state.attendanceRangeStart = event.target.value;
      goToView('attendance');
      return;
    }
    if (event.target.id === 'attendanceRangeEnd') {
      state.attendanceRangeEnd = event.target.value;
      goToView('attendance');
      return;
    }
    if (event.target.id === 'attendanceMonth') {
      state.attendanceMonth = event.target.value;
      goToView('attendance');
      return;
    }
    if (event.target.matches('input[type="file"]')) {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        validateImage(file);
        const preview = event.target.closest('label')?.querySelector('.image-preview');
        if (preview) fileDataUrl(file).then(dataUrl => {
          preview.src = dataUrl;
          preview.hidden = false;
        }).catch(error => showToast(error.message, true));
      } catch (error) {
        event.target.value = '';
        showToast(error instanceof Error ? error.message : 'Invalid image.', true);
      }
      return;
    }
    if (event.target.id === 'tableSearch') {
      state.search = event.target.value;
      const selection = [event.target.selectionStart, event.target.selectionEnd];
      goToView(state.view);
      const search = $('#tableSearch');
      if (search) {
        search.focus();
        search.setSelectionRange(...selection);
      }
    }
  };

  const createAccount = async event => {
    event.preventDefault();
    const form = event.target;
    const values = new FormData(form);
    const role = String(values.get('role') || '');
    const mobile = normalizeMobile(String(values.get('mobile') || ''));
    if (!isValidPakistaniMobile(mobile)) {
      showToast('Enter a valid Pakistani mobile number.', true);
      return;
    }
    const studentSelect = form.elements.namedItem('student_ids');
    const studentIds = studentSelect ? [...studentSelect.selectedOptions].map(option => option.value) : [];
    try {
      await manageAccounts({
        action: 'create',
        role,
        school_id: state.currentSchoolId,
        display_name: String(values.get('display_name') || '').trim(),
        mobile,
        teacher_id: String(values.get('teacher_id') || '') || null,
        student_ids: studentIds
      });
      form.reset();
      showToast('Account created. User signs in with their mobile number.');
      await loadAccounts();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create the account.', true);
    }
  };

  const saveDialog = async event => {
    if (event.submitter && event.submitter.value !== 'save') return;
    event.preventDefault();
    const dialog = $('#recordDialog');
    const table = dialog.dataset.table;
    const id = dialog.dataset.id;
    const form = $('#recordForm');
    const values = Object.fromEntries(new FormData(form).entries());
    const file = values.photo_file;
    const payload = Object.fromEntries(Object.entries(values).filter(([key, value]) => formDefinitions[table]?.fields && key !== 'photo_file' && !key.startsWith('custom_field_') && !(value instanceof File)));
    if (table === 'students' || table === 'teachers') {
      const customFields = {};
      form.querySelectorAll('[data-custom-field-row]').forEach(row => {
        const key = String(row.querySelector('[data-custom-field-key]')?.value || '').trim();
        const value = String(row.querySelector('[data-custom-field-value]')?.value || '').trim();
        if (key) customFields[key] = value;
      });
      payload.extra_fields = customFields;
    }
    if (table === 'students' && !payload.gender) payload.gender = null;
    if (table === 'teachers') {
      payload.email = String(payload.email || '').trim() || null;
      payload.phone = String(payload.phone || '').trim() || null;
    }
    if (table === 'assessments') {
      payload.term = normalizedTerm(payload.term);
      payload.max_marks = Number(payload.max_marks);
      if (payload.assessment_type === 'Monthly test') {
        const month = Number(String(payload.assessment_date).slice(5, 7));
        if (!termMonths[payload.term].some(item => item.month === month)) {
          showToast(`Monthly tests for ${payload.term} must be dated in ${termMonths[payload.term].map(item => item.label).join(', ')}.`, true);
          return;
        }
        if (payload.max_marks !== 20) {
          showToast('Each monthly test must be out of 20 marks.', true);
          return;
        }
        const duplicate = records('assessments').some(row =>
          row.id !== id &&
          row.class_id === payload.class_id &&
          row.subject_id === payload.subject_id &&
          normalizedTerm(row.term) === payload.term &&
          row.assessment_type === 'Monthly test' &&
          String(row.assessment_date || '').slice(0, 4) === String(payload.assessment_date).slice(0, 4) &&
          Number(String(row.assessment_date || '').slice(5, 7)) === month);
        if (duplicate) {
          showToast(`A ${termMonths[payload.term].find(item => item.month === month).label} test already exists for this subject and class.`, true);
          return;
        }
      }
    }
    try {
      let saveId = id || null;
      let savedRecord;
      const previousPhotoPath = id ? records(table).find(row => row.id === id)?.photo_path : null;
      const hasPhoto = file instanceof File && file.size > 0;
      if (hasPhoto) validateImage(file);

      // For new records with a photo, pre-generate the ID so we can upload
      // the image first and save everything in one POST.
      if (hasPhoto && !saveId) {
        saveId = crypto.randomUUID();
      }

      let uploadedPath = '';
      let photoError = null;
      const folder = table === 'students' ? 'students' : 'teachers';

      if (hasPhoto) {
        uploadedPath = `${state.currentSchoolId}/${folder}/${saveId}.${imageExtension(file)}`;
        try {
          await uploadImage(uploadedPath, file);
        } catch (error) {
          photoError = error;
          uploadedPath = '';
        }
      }

      // Include photo_path in payload if upload succeeded
      const savePayload = { ...payload };
      if (uploadedPath) {
        savePayload.photo_path = uploadedPath;
      }
      // For new records with a pre-generated ID, include it in the payload
      if (saveId && !id) {
        savePayload.id = saveId;
      }

      savedRecord = await saveRow(table, savePayload, id ? saveId : null);
      state.data[table] = id
        ? records(table).map(row => row.id === savedRecord.id ? savedRecord : row)
        : [...records(table), savedRecord];

      // Clean up previous photo if replaced
      let cleanupError = null;
      if (!photoError && previousPhotoPath && savedRecord.photo_path !== previousPhotoPath && savedRecord.photo_path) {
        try {
          await removeImage(previousPhotoPath);
        } catch (error) {
          cleanupError = error;
        }
      }

      dialog.close();
      if (table === 'assessments') {
        const assignment = records('class_subjects').find(item =>
          item.class_id === payload.class_id && item.subject_id === payload.subject_id);
        state.assessmentAssignmentId = assignment?.id || state.assessmentAssignmentId;
        state.assessmentTerm = normalizedTerm(payload.term);
      }
      let refreshError = null;
      try {
        await refreshData();
      } catch (error) {
        refreshError = error;
      }
      syncSchoolIdentity();
      goToView(state.view);
      if (refreshError) {
        const message = refreshError instanceof Error ? refreshError.message : 'Unknown refresh error.';
        showToast(`${formDefinitions[table].title} saved, but the latest records could not be reloaded. ${message}`, true);
        return;
      }
      if (photoError) {
        const message = photoError instanceof Error ? photoError.message : 'Unknown picture upload error.';
        showToast(`${formDefinitions[table].title} details saved, but the picture could not be uploaded. ${message}`, true);
        return;
      }
      if (cleanupError) {
        const message = cleanupError instanceof Error ? cleanupError.message : 'Unknown image cleanup error.';
        showToast(`${formDefinitions[table].title} saved, but the previous picture could not be removed. ${message}`, true);
        return;
      }
      showToast(`${formDefinitions[table].title} ${id ? 'updated' : 'added'}.`);
    } catch (error) {
      console.error('saveDialog error:', error);
      const msg = error instanceof Error ? error.message : 'Could not save the record.';
      showToast(msg, true);
    }
  };

  const imageExtension = file => ({ 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[file.type] || '';
  const validateImage = file => {
    if (!imageExtension(file)) throw new Error('Choose a JPG, PNG, or WEBP image.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.');
  };

  const saveSchoolSettings = async event => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const name = String(formData.get('school_name') || '').trim();
    const academicYear = String(formData.get('academic_year') || '').trim();
    const file = formData.get('logo_file');
    if (!name) {
      showToast('Enter the school name.', true);
      return;
    }
    try {
      const payload = { name };
      if (academicYear) payload.academic_year = academicYear;
      if (file instanceof File && file.size) {
        validateImage(file);
        const path = `${state.currentSchoolId}/school/logo.${imageExtension(file)}`;
        payload.logo_path = await uploadImage(path, file);
      }
      await api(`schools?id=eq.${encodeURIComponent(state.currentSchoolId)}`, { method: 'PATCH', body: payload, prefer: 'return=minimal' });
      await refreshData();
      syncSchoolIdentity();
      goToView('school');
      showToast('School settings saved.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save school settings.', true);
    }
  };

  const saveDeveloperCredit = async event => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const name = String(formData.get('credit_name') || '').trim();
    const bio = String(formData.get('credit_bio') || '').trim();
    const file = formData.get('credit_photo');
    const linksText = String(formData.get('credit_links') || '').trim();
    if (!name) {
      showToast('Enter the developer name.', true);
      return;
    }
    const links = linksText.split(/\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.split('|');
      if (parts.length >= 2) {
        return { title: parts[0].trim(), url: parts.slice(1).join('|').trim() };
      }
      const url = parts[0].trim();
      return { title: url, url };
    }).filter(link => link.url);
    try {
      let photo = state.developerCredit?.photo || '';
      if (file instanceof File && file.size) {
        validateImage(file);
        const path = `${state.currentSchoolId || 'developer'}/developer/credit-photo.${imageExtension(file)}`;
        if (photo && !photo.startsWith('data:')) {
          // remove old stored path? keep simple
        }
        photo = `${supabaseUrl}/storage/v1/object/public/school-media/${path.split('/').map(encodeURIComponent).join('/')}`;
        await uploadImage(path, file);
      }
      const credit = { name, bio, photo, links };
      state.developerCredit = credit;
      localStorage.setItem('developerCredit', JSON.stringify(credit));
      goToView('credit');
      showToast('Credit page saved.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save credit page.', true);
    }
  };

  const audioExtension = type => ({ 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav' })[type] || '';

  let homeworkRecording = false;
  let homeworkChunks = [];
  const startHomeworkVoice = lang => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice recognition is not supported in this browser.', true);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0].transcript).join(' ');
      const field = document.querySelector('[name="homework_content"]');
      if (field && event.results[event.results.length - 1].isFinal) {
        field.value = `${field.value ? `${field.value} ` : ''}${transcript}`.trim();
      }
    };
    recognition.onerror = event => showToast(`Voice recognition error: ${event.error}`, true);
    recognition.start();
  };
  const toggleHomeworkRecording = async () => {
    const status = document.getElementById('homeworkRecordStatus');
    const btn = document.getElementById('homeworkRecordBtn');
    if (!homeworkRecording) {
      if (!navigator.mediaDevices?.getUserMedia) {
        showToast('Audio recording is not supported in this browser.', true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        homeworkChunks = [];
        recorder.ondataavailable = event => {
          if (event.data?.size) homeworkChunks.push(event.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(homeworkChunks, { type: recorder.mimeType || 'audio/webm' });
          window.pendingHomeworkAudio = blob;
          stream.getTracks().forEach(track => track.stop());
          if (status) status.textContent = 'Audio recorded. It will be uploaded when you save.';
          if (btn) btn.textContent = 'Record audio';
          homeworkRecording = false;
        };
        recorder.start();
        window.homeworkRecorder = recorder;
        homeworkRecording = true;
        if (btn) btn.textContent = 'Stop recording';
        if (status) status.textContent = 'Recording...';
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not start recording.', true);
      }
    } else if (window.homeworkRecorder) {
      window.homeworkRecorder.stop();
    }
  };

  const saveHomeworkDiary = async event => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const classId = String(formData.get('homework_class_id') || '').trim();
    const subjectId = String(formData.get('homework_subject_id') || '').trim();
    const teacherId = String(formData.get('homework_teacher_id') || '').trim();
    const date = String(formData.get('homework_date') || '').trim();
    const topic = String(formData.get('homework_topic') || '').trim();
    const content = String(formData.get('homework_content') || '').trim();
    const imageFiles = Array.from(formData.getAll('homework_images')).filter(file => file instanceof File && file.size);
    const audioFile = formData.get('homework_audio');
    const recorded = window.pendingHomeworkAudio || null;
    if (!classId || !subjectId || !teacherId || !date || !topic) {
      showToast('Complete all required homework fields.', true);
      return;
    }
    try {
      const imagePaths = [];
      for (const file of imageFiles) {
        validateImage(file);
        const ext = imageExtension(file);
        const path = `${state.currentSchoolId}/homework/${(crypto.randomUUID ? crypto.randomUUID() : Date.now())}.${ext}`;
        await uploadImage(path, file);
        imagePaths.push(path);
      }
      let audioPath = '';
      const audioToUpload = recorded instanceof Blob
        ? new File([recorded], `voice.${audioExtension(recorded.type || 'audio/webm')}`, { type: recorded.type || 'audio/webm' })
        : (audioFile instanceof File && audioFile.size ? audioFile : null);
      if (audioToUpload) {
        const ext = audioExtension(audioToUpload.type);
        if (!ext) throw new Error('Unsupported audio type.');
        const path = `${state.currentSchoolId}/homework/${(crypto.randomUUID ? crypto.randomUUID() : Date.now())}.${ext}`;
        await uploadImage(path, audioToUpload);
        audioPath = path;
      }
      await api('homework_diaries', {
        method: 'POST',
        body: {
          school_id: state.currentSchoolId,
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId,
          homework_date: date,
          topic,
          content: content || null,
          image_paths: imagePaths,
          audio_path: audioPath || null,
          created_by: state.user?.id || null
        },
        prefer: 'return=representation'
      });
      window.pendingHomeworkAudio = null;
      const status = document.getElementById('homeworkRecordStatus');
      if (status) status.textContent = '';
      await refreshData();
      goToView('homework');
      showToast('Homework diary saved.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save homework diary.', true);
    }
  };

  const saveAttendance = async () => {
    if (!['developer', 'admin', 'teacher'].includes(state.profile?.role)) {
      throw new Error('Your account is not allowed to record attendance.');
    }
    const assignment = attendanceAssignment();
    if (state.profile.role === 'teacher' &&
        (!assignment || assignment.teacher_id !== state.profile.teacher_id)) {
      throw new Error('Select a subject assigned to your teacher account before saving attendance.');
    }
    const students = attendanceStudents();
    if (!students.length) throw new Error('There are no students in the selected class.');
    const start = state.attendanceRangeMode ? state.attendanceRangeStart : state.attendanceDate;
    const end = state.attendanceRangeMode ? state.attendanceRangeEnd : state.attendanceDate;
    // Parse dates in Pakistan timezone (Asia/Karachi, UTC+5) to ensure
    // the date range is calculated consistently regardless of browser TZ.
    const startDate = new Date(`${start}T12:00:00`);
    startDate.setMinutes(startDate.getMinutes() + 5 * 60);
    const endDate = new Date(`${end}T12:00:00`);
    endDate.setMinutes(endDate.getMinutes() + 5 * 60);
    if (!start || !end || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) ||
        localDateISO(startDate) !== start || localDateISO(endDate) !== end || endDate < startDate) {
      throw new Error('Choose a valid start and end date. The end date must not be before the start date.');
    }
    // Weekend restriction: Saturdays and Sundays are off; only Monday-Friday entries allowed.
    for (let offset = 0; offset <= Math.round((endDate - startDate) / 86400000); offset++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + offset);
      const day = checkDate.getDay();
      if (day === 0 || day === 6) {
        throw new Error(`Attendance cannot be saved for ${checkDate.toDateString()} (${checkDate.toLocaleDateString('en', { weekday: 'long' })}). Weekends (Saturday and Sunday) are off; only Monday to Friday entries are allowed.`);
      }
    }
    const dayCount = Math.round((endDate - startDate) / 86400000) + 1;
    if (dayCount > 366) throw new Error('Attendance can be applied to at most 366 days at a time.');
    const maxRows = 10000;
    if (students.length * dayCount > maxRows) {
      throw new Error(`This range would create more than ${maxRows.toLocaleString()} attendance records. Choose a shorter date range or a smaller class.`);
    }
    const validStatuses = new Set(['present', 'absent', 'leave', 'holiday']);
    const rows = [];
    for (let offset = 0; offset < dayCount; offset++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + offset);
      // Use Pakistan timezone for consistent date representation
      const attendanceDate = pakistanDateISO(date);
      for (const student of students) {
        // Use present as default, but if the student has a status override, use it
        const status = state.attendanceStatuses[student.id] || 'present';
        if (!validStatuses.has(status)) throw new Error('Select a valid attendance status for every student.');
        rows.push({
          student_id: student.id,
          class_id: student.class_id,
          ...(assignment ? { subject_id: assignment.subject_id } : {}),
          attendance_date: attendanceDate,
          status,
          school_id: state.currentSchoolId
        });
      }
    }
    // All rows already contain every student for every date with the correct status
    // (from state.attendanceStatuses or 'present' default). No filtering or duplication needed.
    const refinedRows = rows;

    const targetTable = assignment ? 'subject_attendance' : 'attendance';
    for (let offset = 0; offset < refinedRows.length; offset += 500) {
      await api(`${targetTable}?on_conflict=student_id,${assignment ? 'subject_id,' : ''}attendance_date`, {
        method: 'POST',
        body: refinedRows.slice(offset, offset + 500),
        prefer: 'resolution=merge-duplicates,return=minimal'
      });
    }
    // Verify the data was actually saved to the database.
    await refreshData();
    const savedCount = (assignment ? records('subject_attendance') : records('attendance'))
      .filter(row => {
        const rowDate = row.attendance_date;
        return rowDate >= start && rowDate <= end &&
          (assignment ? row.subject_id === assignment.subject_id : true);
      }).length;
    const expectedCount = students.length * dayCount;
    if (savedCount < expectedCount) {
      throw new Error(`Attendance verification failed: expected ${expectedCount} records but found ${savedCount} in the database. Please try saving again.`);
    }
    console.log(`[saveAttendance] Verification passed: ${students.length} students × ${dayCount} day(s) = ${expectedCount} records. DB records found: ${savedCount}`);
    state.attendanceStatuses = {};
    goToView('attendance');
    showToast(`Attendance saved and verified in database: ${students.length} students × ${dayCount} day${dayCount === 1 ? '' : 's'} = ${expectedCount} records.`);
  };

  const saveMarks = async () => {
    const assignment = records('class_subjects').find(row => row.id === state.assessmentAssignmentId);
    if (!assignment) throw new Error('Select a class and subject before saving marks.');
    if (!isManager() && (state.profile.role !== 'teacher' || assignment.teacher_id !== state.profile.teacher_id)) {
      throw new Error('Your account is not allowed to enter marks for this subject.');
    }
    const enrolledIds = new Set(records('subject_enrollments')
      .filter(row => row.assignment_id === assignment.id)
      .map(row => row.student_id));
    const inputs = [...pageContent.querySelectorAll('.gradebook-score')].filter(input => !input.disabled);
    const existingMarks = records('marks');
    const rows = [];
    const removals = [];
    for (const input of inputs) {
      if (input.validity.badInput || input.validity.stepMismatch) {
        throw new Error('Enter marks as numbers with no more than two decimal places.');
      }
      const assessment = records('assessments').find(row =>
        row.id === input.dataset.assessmentId &&
        row.class_id === assignment.class_id &&
        row.subject_id === assignment.subject_id);
      if (!assessment) throw new Error('A mark refers to an assessment outside the selected subject.');
      const existing = existingMarks.find(mark =>
        mark.assessment_id === assessment.id && mark.student_id === input.dataset.student);
      const score = enteredScore(input.value);
      if (input.value.trim() === '' || isAbsentEntry(input.value)) {
        if (existing) {
          if (!enrolledIds.has(input.dataset.student)) throw new Error('Only enrolled students can have marks cleared.');
          removals.push({ assessmentId: assessment.id, studentId: input.dataset.student });
        }
        continue;
      }
      if (assessment.assessment_type === 'Monthly test' &&
          !/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(input.value.trim())) {
        throw new Error('Monthly scores must be numbers with no more than two decimal places, or A/Absent.');
      }
      if (!Number.isFinite(score)) throw new Error('Enter a numeric score, or use A/Absent for a monthly absence.');
      if (!enrolledIds.has(input.dataset.student)) throw new Error('Only students assigned to this subject can receive marks.');
      if (assessment.assessment_type === 'Monthly test') {
        const month = Number(String(assessment.assessment_date || '').slice(5, 7));
        if (Number(assessment.max_marks) !== 20 || !termMonths[normalizedTerm(assessment.term)]
          .some(item => item.month === month)) {
          throw new Error('Monthly tests must be scheduled in their term months and be out of 20 marks.');
        }
      }
      if (!Number.isFinite(score) || score < 0 || score > Number(assessment.max_marks)) {
        throw new Error(`Scores must be between 0 and ${assessment.max_marks} for ${assessment.title}.`);
      }
      rows.push({
        assessment_id: assessment.id,
        student_id: input.dataset.student,
        score,
        school_id: state.currentSchoolId
      });
    }
    if (!rows.length && !removals.length) throw new Error('Enter or clear at least one mark before saving.');
    if (rows.length) {
      await api('marks?on_conflict=assessment_id,student_id', {
        method: 'POST', body: rows, prefer: 'resolution=merge-duplicates,return=minimal'
      });
    }
    for (const row of removals) {
      await api(`marks?assessment_id=eq.${encodeURIComponent(row.assessmentId)}&student_id=eq.${encodeURIComponent(row.studentId)}`, {
        method: 'DELETE',
        prefer: 'return=minimal'
      });
    }
    await refreshData();
    goToView('assessments');
    showToast(`Saved ${rows.length} mark${rows.length === 1 ? '' : 's'}${removals.length ? ` and cleared ${removals.length} blank score${removals.length === 1 ? '' : 's'}` : ''}.`);
  };

  const saveSubjectEnrollments = async () => {
    const assignment = records('class_subjects').find(row => row.id === state.assessmentAssignmentId);
    if (!assignment || (!isManager() && (state.profile.role !== 'teacher' || assignment.teacher_id !== state.profile.teacher_id))) {
      throw new Error('You are not allowed to assign students to this subject.');
    }
    const classStudentIds = new Set(records('students')
      .filter(student => student.class_id === assignment.class_id)
      .map(student => student.id));
    const selectedIds = new Set([...pageContent.querySelectorAll('[data-enroll-student]:checked')]
      .map(input => input.value));
    if ([...selectedIds].some(id => !classStudentIds.has(id))) {
      throw new Error('Only students in the selected class can be assigned to this subject.');
    }
    const currentRows = records('subject_enrollments').filter(row => row.assignment_id === assignment.id);
    const currentIds = new Set(currentRows.map(row => row.student_id));
    const additions = [...selectedIds].filter(id => !currentIds.has(id));
    const removals = currentRows.filter(row => !selectedIds.has(row.student_id));
    for (const row of removals) {
      await api(`subject_enrollments?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
        prefer: 'return=minimal'
      });
    }
    if (additions.length) {
      await api('subject_enrollments', {
        method: 'POST',
        body: additions.map(student_id => ({
          school_id: state.currentSchoolId,
          assignment_id: assignment.id,
          student_id
        })),
        prefer: 'return=minimal'
      });
    }
    await refreshData();
    state.assessmentEnrollOpen = false;
    goToView('assessments');
    showToast(`Subject enrollment saved: ${selectedIds.size} students assigned.`);
  };

  const initialize = () => {
    const configured = isConfigured;
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-class-strength');
      document.body.classList.remove('printing-report-card');
    });
    $('#modeBanner').textContent = configured
      ? 'Sign in with the account provided by your school administrator. The app never stores your password.'
      : 'Database setup required. Sample records have been removed and sign-in is unavailable until you connect Supabase. Create a Supabase project, run supabase-schema.sql, then set its Project URL and public anon key in config.js. Never put a service-role key here.';
    $('#loginForm').classList.toggle('hidden', !configured);
    $('#loginRoleChoices').classList.toggle('hidden', !configured);
    if (configured) $('#modeBanner').classList.add('secure');

    $('#loginForm').addEventListener('submit', signIn);
    // Sync initial button states with selectedLoginRole
    const syncRoleButtons = () => {
      try {
        const buttons = document.querySelectorAll('[data-login-role]');
        buttons.forEach(button => {
          const selected = button.dataset.loginRole === state.selectedLoginRole;
          button.classList.toggle('selected', selected);
          button.setAttribute('aria-pressed', String(selected));
        });
      } catch (e) {
        console.error('Error syncing role buttons:', e);
      }
    };
    
    // Attach role choice click handler
    const roleChoicesEl = $('#loginRoleChoices');
    if (roleChoicesEl) {
      roleChoicesEl.addEventListener('click', event => {
        try {
          const choice = event.target.closest('[data-login-role]');
          if (!choice) return;
          state.selectedLoginRole = choice.dataset.loginRole;
          setLoginMessage('');
          syncRoleButtons();
        } catch (e) {
          console.error('Error handling role choice click:', e);
        }
      });
    }
    
    // Initialize button states - run after a brief delay to ensure DOM is ready
    // and also on any subsequent role changes
    setTimeout(() => {
      try {
        const roleChoices = $('#loginRoleChoices');
        if (roleChoices && !roleChoices.classList.contains('hidden')) {
          syncRoleButtons();
        }
      } catch (e) {
        console.error('Error initializing role buttons:', e);
      }
    }, 100);
    const loginModeToggle = $('#loginModeToggle');
    if (loginModeToggle) loginModeToggle.addEventListener('click', event => {
      const btn = event.target.closest('[data-login-mode]');
      if (!btn) return;
      state.loginMode = btn.dataset.loginMode;
      const register = state.loginMode === 'register';
      $('#registerNameField').classList.toggle('hidden', !register);
      $('#loginSubmitButton').innerHTML = register ? 'Create account <span aria-hidden="true">→</span>' : 'Sign in <span aria-hidden="true">→</span>';
      document.querySelectorAll('[data-login-mode]').forEach(button => {
        button.classList.toggle('selected', button === btn);
      });
      setLoginMessage('');
    });
    $('#schoolPicker').addEventListener('change', async event => {
      state.currentSchoolId = event.target.value;
      try {
        await refreshData();
        syncSchoolIdentity();
        goToView(state.view);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not load this school.', true);
      }
    });
    $('#signOutButton').addEventListener('click', logout);
    $('#mainNav').addEventListener('click', event => {
      const button = event.target.closest('[data-view]');
      if (button) goToView(button.dataset.view);
    });
    pageContent.addEventListener('click', handleClick);
    pageContent.addEventListener('input', event => {
      if (event.target.id === 'classStrengthSearch') {
        state.classStrengthSearch = event.target.value;
        const query = state.classStrengthSearch.trim().toLocaleLowerCase();
        const rows = [...pageContent.querySelectorAll('[data-class-strength-row]')];
        let visibleCount = 0;
        rows.forEach(row => {
          const matches = row.dataset.search.includes(query);
          row.hidden = !matches;
          if (matches) visibleCount += 1;
        });
        $('#classStrengthCount').textContent = `Showing ${visibleCount} of ${rows.length} Classes`;
        const noResultsRow = $('#classStrengthNoResults');
        if (noResultsRow) noResultsRow.hidden = visibleCount > 0;
      }
      if (event.target.matches('.gradebook-score')) gradebookRowTotals(event.target.closest('[data-gradebook-row]'));
    });
    pageContent.addEventListener('change', handlePageChange);
    pageContent.addEventListener('submit', event => {
      if (event.target.id === 'createAccountForm') createAccount(event);
      if (event.target.id === 'schoolSettingsForm') saveSchoolSettings(event);
       if (event.target.id === 'newSessionForm') startNewSession(event);
      if (event.target.id === 'developerCreditForm') saveDeveloperCredit(event);
      if (event.target.id === 'homeworkDiaryForm') saveHomeworkDiary(event);
    });
    $('#recordForm').addEventListener('change', handlePageChange);
    $('#recordForm').addEventListener('submit', saveDialog);
    $('#saveRecordButton').addEventListener('click', () => {
      saveDialog({ preventDefault() {} });
    });
    $('#recordDialog').addEventListener('click', event => {
      const addButton = event.target.closest('[data-add-custom-field]');
      if (addButton) {
        const editor = addButton.closest('[data-custom-fields-editor]');
        const list = editor?.querySelector('.custom-fields-list');
        if (list) list.insertAdjacentHTML('beforeend', customFieldRow());
        return;
      }
      const removeButton = event.target.closest('[data-remove-custom-field]');
      if (removeButton) {
        removeButton.closest('[data-custom-field-row]')?.remove();
        return;
      }
      if (event.target === $('#recordDialog')) $('#recordDialog').close();
      if (event.target.closest('[value="cancel"]')) $('#recordDialog').close();
    });
    pageContent.addEventListener('click', async event => {
      if (event.target.closest('#saveAttendance')) {
        try { await saveAttendance(); }
        catch (error) { showToast(error instanceof Error ? error.message : 'Could not save attendance.', true); }
      }
      if (event.target.closest('#saveMarks')) {
        if (!window.confirm('Confirm and verify all entered marks before saving?')) return;
        try { await saveMarks(); }
        catch (error) { showToast(error instanceof Error ? error.message : 'Could not save marks.', true); }
      }
    });
    $('#helpButton').addEventListener('click', () => showToast('Contact your school administrator for help.'));
    $('#notificationButton').addEventListener('click', () => showToast('You are all caught up.'));
    $('#profileButton').addEventListener('click', () => showToast(`${$('#profileName').textContent} · ${$('#profileRole').textContent}`));

    // Keyboard shortcuts for bulk attendance status: P=Present, A=Absent, H=Holiday, L=Leave
    window.addEventListener('keydown', event => {
      if (state.view !== 'attendance') return;
      if (!['developer', 'admin', 'teacher'].includes(state.profile?.role)) return;
      const key = event.key.toLowerCase();
      const statusMap = { p: 'present', a: 'absent', h: 'holiday', l: 'leave' };
      const status = statusMap[key];
      if (!status) return;
      const canTake = isManager() || (state.profile.role === 'teacher' && attendanceAssignment()?.teacher_id === state.profile.teacher_id);
      if (!canTake) return;
      event.preventDefault();
      for (const student of attendanceStudents()) state.attendanceStatuses[student.id] = status;
      goToView('attendance');
      showToast(`All students marked ${status.charAt(0).toUpperCase() + status.slice(1)}. Press P/A/H/L to change all.`);
    });
  };

  initialize();
})();
