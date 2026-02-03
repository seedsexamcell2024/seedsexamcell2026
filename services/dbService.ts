
import { SIDE } from './databaseEngine.ts';
import { VDB } from './virtualDatabase.ts';
import { cloudPush, cloudPull } from './sheetService.ts';
import { getCloudUrl } from '../config.ts';

/**
 * SEEDS UNIFIED VAULT PROTOCOL (UVP) v10.1
 * MISSION: ELIMINATE BLOCKING CALLS & ENSURE INSTANT INTERFACE
 */

export const STORES = ['classes', 'teachers', 'subjects', 'students', 'marks', 'attendance', 'identity'];

export const getActiveSessionYear = (): string => localStorage.getItem('active_session_year') || '2025-2026';
export const getActiveTerm = (): string => localStorage.getItem('active_term') || '1st';

export const setActiveSessionYear = (year: string): void => localStorage.setItem('active_session_year', year);
export const setActiveTerm = (term: string): void => localStorage.setItem('active_term', term);

/**
 * High-Speed Local Persistence with Background Cloud Mirroring
 */
export const saveData = async (storeName: string, data: any[]): Promise<boolean> => {
  const masterKey = `ILE_MASTER_${storeName.toUpperCase()}`;
  try {
    // 1. Commit to Memory (Instant)
    VDB.populateTable(storeName as any, data, true);
    
    // 2. Persist to IndexedDB (Fast)
    let fullDataSet = (storeName === 'attendance') ? VDB.getFlatAttendance() : VDB.queryAll(storeName as any);
    await SIDE.save(masterKey, fullDataSet);

    // 3. Notify UI (Reactive)
    window.dispatchEvent(new CustomEvent('DATA_UPDATED', { detail: { storeName } }));

    // 4. Background Cloud Sync (Silent - DO NOT AWAIT)
    if (navigator.onLine && getCloudUrl()) {
      cloudPush(storeName, getActiveSessionYear(), getActiveTerm(), fullDataSet).catch(() => {});
    }

    return true;
  } catch (e) {
    console.error("Critical Vault Failure:", e);
    return false;
  }
};

/**
 * Optimistic Data Loader: Returns local data instantly, syncs cloud in background.
 */
export const loadData = async (storeName: string, force: boolean = false): Promise<any[]> => {
  const masterKey = `ILE_MASTER_${storeName.toUpperCase()}`;
  
  // PHASE 1: Immediate Local Recovery
  const localData = await SIDE.load<any[]>(masterKey) || [];
  if (localData.length > 0) {
    VDB.populateTable(storeName as any, localData, false);
    window.dispatchEvent(new CustomEvent('DATA_UPDATED', { detail: { storeName, source: 'local' } }));
  }

  // PHASE 2: Silent Cloud Background Update
  if (navigator.onLine && getCloudUrl()) {
     cloudPull(storeName, "", "").then(cloudResult => {
       if (cloudResult && Array.isArray(cloudResult) && cloudResult.length > 0) {
         VDB.partitionUnifiedLedger(cloudResult);
         
         // After partitioning (merging cloud data into VDB), we save the specific requested store back to local
         const partitioned = (storeName === 'attendance') ? VDB.getFlatAttendance() : VDB.queryAll(storeName as any);
         SIDE.save(masterKey, partitioned);
         
         // Critical: Broadcast update so dropdowns across the app refresh
         window.dispatchEvent(new CustomEvent('DATA_UPDATED', { detail: { storeName, source: 'cloud' } }));
       }
     }).catch(() => {});
  }
  
  return (storeName === 'attendance') ? VDB.getFlatAttendance() : VDB.queryAll(storeName as any);
};

/**
 * Total System Boot: Initialized as a side-effect to prevent blocking index.tsx
 */
export const institutionalBoot = async (): Promise<boolean> => {
  try {
    STORES.forEach(s => loadData(s, false));
    window.dispatchEvent(new CustomEvent('BOOT_COMPLETE'));
    return true;
  } catch (e) {
    return false;
  }
};

export const performCascadingDelete = async (type: 'STUDENT' | 'TEACHER' | 'SUBJECT' | 'CLASS', id: string): Promise<boolean> => {
  try {
    const nId = VDB.normalize(id);
    if (type === 'CLASS') {
      const studentsInClass = VDB.getStudentsByClass(id);
      studentsInClass.forEach(s => {
        VDB.deleteFromTable('students', s.id);
        VDB.purgeStudentAttendance(s.id);
      });
      const subjectsInClass = VDB.queryAll<any>('subjects').filter(s => VDB.normalize(s.gradeId) === nId);
      subjectsInClass.forEach(sub => VDB.deleteFromTable('subjects', sub.id));
      VDB.deleteFromTable('classes', id);
    } else if (type === 'STUDENT') {
      VDB.deleteFromTable('students', id);
      VDB.purgeStudentAttendance(id);
    } else if (type === 'SUBJECT') {
      VDB.deleteFromTable('subjects', id);
    } else if (type === 'TEACHER') {
      VDB.deleteFromTable('teachers', id);
    }

    const affectedStores = ['students', 'classes', 'subjects', 'teachers', 'marks', 'attendance'];
    for (const store of affectedStores) {
      const data = store === 'attendance' ? VDB.getFlatAttendance() : VDB.queryAll(store as any);
      await saveData(store, data);
    }
    return true;
  } catch (err) {
    return false;
  }
};

export const autoSave = (storeName: string, data: any[]): void => {
  saveData(storeName, data);
};

export const getPKTDateString = (): string => {
  const now = new Date();
  const pktOffset = 5 * 60; 
  const pktDate = new Date(now.getTime() + (pktOffset * 60 * 1000));
  return pktDate.toISOString().split('T')[0];
};

export const getPKTDisplayDate = (dateStr?: string): string => {
  const date = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const purgeAndReboot = async (): Promise<void> => {
  if (!window.confirm("CRITICAL: Permanently erase ALL local nodes?")) return;
  await SIDE.purge();
  VDB.purge();
  localStorage.clear();
  window.location.href = window.location.pathname;
};
