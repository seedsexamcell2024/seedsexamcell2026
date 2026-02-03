
/**
 * SEEDS VIRTUAL DATA ENGINE (VDE) v906.0
 * MISSION: INTELLIGENT DATA MERGING & PERSISTENCE SHIELD
 */

import { Student, ClassLevel, Teacher, Subject, Mark, AttendanceRecord, TimetableEntry } from '../types.ts';

class VirtualDatabase {
  private static instance: VirtualDatabase;
  public syncCounter = 0;

  private tables = {
    classes: new Map<string, ClassLevel>(),
    students: new Map<string, Student>(),
    teachers: new Map<string, Teacher>(),
    subjects: new Map<string, Subject>(),
    marks: new Map<string, Mark>(),
    timetables: new Map<string, TimetableEntry>(),
    identity: new Map<string, any>(),
    deadlines: new Map<string, any>(),
    compliance_logs: new Map<string, any>(),
    announcements: new Map<string, any>(),
    registry: new Map<string, Map<string, { status: string, termId: string, yearId: string }>>()
  };

  private constructor() {}

  public static getInstance(): VirtualDatabase {
    if (!this.instance) this.instance = new VirtualDatabase();
    return this.instance;
  }

  /**
   * INTELLIGENT MERGE PROTOCOL (IMP) v906
   * Refined to perform an additive merge instead of a destructive purge.
   * This ensures local data survives even if the cloud node returns partial results.
   */
  public partitionUnifiedLedger(rows: any[]) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    
    // We no longer call this.purge() here to prevent data loss during sync flickers.
    // Instead, we rely on populateTable's overwrite:false behavior via additive looping.

    rows.forEach(row => {
      try {
        const type = row.storeType?.toLowerCase();
        const data = JSON.parse(row.jsonData || "{}");
        
        if (type === 'attendance') {
          this.populateTable('attendance', [data], false);
        } else {
          // Additive population: Updates existing IDs, appends new ones.
          this.populateTable(type as any, [data], false);
        }
      } catch (e) {
        console.error("Ledger Parsing Error:", e);
      }
    });

    this.syncCounter++;
  }

  public toCanonicalTerm(term: any): '1st' | '2nd' | 'GLOBAL' {
    const t = String(term || '').trim().toLowerCase();
    if (t === 'global' || t === 'master') return 'GLOBAL';
    if (t.startsWith('1') || t.includes('first')) return '1st';
    if (t.startsWith('2') || t.includes('second')) return '2nd';
    return '1st'; 
  }

  public toCanonicalYear(year: any): string {
    const y = String(year || '').trim();
    if (!y) return '2025-2026';
    const rangeMatch = y.match(/(\d{4})-(\d{4})/);
    if (rangeMatch) return `${rangeMatch[1]}-${rangeMatch[2]}`;
    const singleMatch = y.match(/\d{4}/);
    if (singleMatch) {
      const yr = parseInt(singleMatch[0]);
      return `${yr}-${yr + 1}`;
    }
    return '2025-2026';
  }

  public toCanonicalMonth(month: any): string {
    const m = String(month || '').trim().toLowerCase();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const found = months.find(name => name.toLowerCase().startsWith(m.substring(0, 3)));
    return found || "January";
  }

  public normalize(val: any): string {
    return String(val || '').trim().toLowerCase();
  }

  public normalizeDateString(dateVal: any): string {
    if (!dateVal) return '';
    if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];
    let str = String(dateVal).split('T')[0].trim().replace(/\//g, '-').replace(/\./g, '-');
    const parts = str.split('-').map(p => p.trim());
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return str;
  }

  public isWeekend(dateStr: string): boolean {
    const normalized = this.normalizeDateString(dateStr);
    if (!normalized || normalized.length < 10) return false;
    try {
        const parts = normalized.split('-').map(Number);
        if (parts.length !== 3) return false;
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        return dateObj.getDay() === 0 || dateObj.getDay() === 6; 
    } catch (e) {
        return false;
    }
  }

  public populateTable(tableName: keyof typeof this.tables | 'attendance', data: any[], overwrite: boolean = true) {
    if (!Array.isArray(data)) return;
    
    if (tableName === 'attendance') {
      data.forEach(item => {
        if (!item) return;
        const sId = this.normalize(item.studentId);
        const dateRaw = item.date;
        if (!sId || !dateRaw) return;

        const dKey = this.normalizeDateString(dateRaw);
        let datePartition = this.tables.registry.get(dKey);
        if (!datePartition) { 
          datePartition = new Map(); 
          this.tables.registry.set(dKey, datePartition); 
        }
        datePartition.set(sId, {
          status: String(item.status || '-').toUpperCase().trim(),
          termId: this.toCanonicalTerm(item.termId),
          yearId: this.toCanonicalYear(item.yearId)
        });
      });
    } else {
      const table = this.tables[tableName as keyof typeof this.tables];
      if (table instanceof Map) {
        if (overwrite) table.clear();
        data.forEach(item => { 
          if (!item) return;
          const actualId = item.id;
          if (actualId) {
            const normalizedId = this.normalize(actualId);
            table.set(normalizedId, { ...item, id: normalizedId }); 
          }
        });
      }
    }
    this.syncCounter++;
  }

  public queryAll<T>(tableName: keyof typeof this.tables): T[] {
    const table = this.tables[tableName];
    return table ? Array.from(table.values() as any) : [];
  }

  public getStudentsByClass(classId: string): Student[] {
    if (!classId) return [];
    const normalizedClassId = this.normalize(classId);
    return this.queryAll<Student>('students')
      .filter(s => this.normalize(s.gradeId) === normalizedClassId)
      .sort((a, b) => (a.serialNumber || 0) - (b.serialNumber || 0));
  }

  public getAttendanceStatus(studentId: string, dateStr: string): string {
    const datePartition = this.tables.registry.get(this.normalizeDateString(dateStr));
    if (!datePartition) return '-';
    const record = datePartition.get(this.normalize(studentId));
    return record?.status || '-';
  }

  public getFlatAttendance(yearFilter?: string): AttendanceRecord[] {
    const flat: AttendanceRecord[] = [];
    const canonicalYear = yearFilter ? this.toCanonicalYear(yearFilter) : undefined;
    
    this.tables.registry.forEach((studentMap, dKey) => {
      studentMap.forEach((record, sId) => {
        if (canonicalYear && record.yearId !== canonicalYear) return;
        flat.push({ 
          id: `REC_${sId}_${dKey}`, 
          studentId: sId, 
          date: dKey, 
          status: record.status as any, 
          yearId: record.yearId, 
          termId: record.termId as any 
        });
      });
    });
    return flat;
  }

  public getDatesWithDataForGrade(gradeId: string, year: string): string[] {
    const students = this.getStudentsByClass(gradeId);
    if (students.length === 0) return [];
    
    const studentIds = new Set(students.map(s => this.normalize(s.id)));
    const datesWithData = new Set<string>();
    const cYear = this.toCanonicalYear(year);

    this.tables.registry.forEach((studentMap, dateKey) => {
      for (const [sId, record] of studentMap.entries()) {
        if (studentIds.has(sId) && record.status !== '-' && record.yearId === cYear) {
          datesWithData.add(dateKey);
          break;
        }
      }
    });

    return Array.from(datesWithData).sort();
  }

  public deleteFromTable(tableName: keyof typeof this.tables, id: string) {
    const table = this.tables[tableName];
    if (table instanceof Map) table.delete(this.normalize(id));
  }

  public purgeStudentAttendance(studentId: string) {
    const sId = this.normalize(studentId);
    this.tables.registry.forEach((studentMap) => {
      studentMap.delete(sId);
    });
    this.syncCounter++;
  }

  public purge() { 
    Object.values(this.tables).forEach(t => { 
      if (t instanceof Map) t.clear(); 
    }); 
  }
}

export const VDB = VirtualDatabase.getInstance();
