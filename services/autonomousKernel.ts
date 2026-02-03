
import { STORES, loadData, saveData } from './dbService.ts';
import { VDB } from './virtualDatabase.ts';
import { PERMANENT_CONFIG } from '../config.ts';

export interface DiagnosticReport {
  timestamp: string;
  status: 'NOMINAL' | 'REPAIRED' | 'CRITICAL';
  integrityScore: number;
  logs: string[];
}

/**
 * SEEDS KERNEL AUTONOMY (SKA) v112.0
 * MISSION: INTELLIGENT CACHE-FIRST AUDITING
 */
class AutonomousKernel {
  private static instance: AutonomousKernel;
  private isScanning: boolean = false;
  private currentReport: DiagnosticReport | null = null;

  private constructor() {}

  public static getInstance(): AutonomousKernel {
    if (!this.instance) this.instance = new AutonomousKernel();
    return this.instance;
  }

  /**
   * The Rectification Test: Scans for logical flaws.
   * v112 Optimization: Only force syncs metadata if CACHE is empty or deep-audit is requested.
   */
  public async runInstitutionalAudit(forceSync: boolean = false): Promise<DiagnosticReport> {
    if (this.isScanning) return this.currentReport!;
    this.isScanning = true;
    
    const logs: string[] = ["Initializing Rectification Test...", "Scanning Academic Vaults..."];
    let repairs = 0;
    let issuesFound = 0;

    try {
      // 1. SELECTIVE DATA RECOVERY (Prefer Cache)
      const stores = ['identity', 'classes', 'subjects', 'teachers', 'students'];
      // Only force pull if the vault is literally empty or user requested forceSync
      await Promise.all(stores.map(async (s) => {
        const local = VDB.queryAll(s as any);
        if (local.length === 0 || forceSync) {
          await loadData(s, forceSync);
        }
      }));
      
      logs.push("Vault Synchronization: Verified.");

      // 2. INTEGRITY SCAN: Students vs Classes
      const students = VDB.queryAll<any>('students');
      const classes = VDB.queryAll<any>('classes');
      const classIds = classes.map(c => c.id);

      students.forEach(s => {
        if (s.gradeId && !classIds.includes(s.gradeId)) {
          issuesFound++;
          logs.push(`Integrity Flaw: Candidate [${s.name}] unlinked from Grade.`);
        }
      });

      // 3. IDENTITY RECTIFICATION
      if (localStorage.getItem('schoolName') !== PERMANENT_CONFIG.name) {
        localStorage.setItem('schoolName', PERMANENT_CONFIG.name);
        repairs++;
      }
      
      if (!localStorage.getItem('schoolLogo')) {
        localStorage.setItem('schoolLogo', PERMANENT_CONFIG.monogram);
      }

      const status: 'NOMINAL' | 'REPAIRED' | 'CRITICAL' = repairs > 0 ? 'REPAIRED' : (issuesFound > 20 ? 'CRITICAL' : 'NOMINAL');
      
      this.currentReport = {
        timestamp: new Date().toISOString(),
        status,
        integrityScore: Math.max(0, 100 - (issuesFound * 2)),
        logs
      };

      return this.currentReport;
    } catch (err) {
      return { 
        timestamp: new Date().toISOString(), 
        status: 'CRITICAL', 
        integrityScore: 0, 
        logs: ["Audit Terminated: " + String(err)] 
      };
    } finally {
      this.isScanning = false;
    }
  }

  public async runSelfDiagnostic(): Promise<void> {
    // Non-blocking background scan
    this.runInstitutionalAudit(false);
  }

  public getStatus() { return this.currentReport; }
}

export const Kernel = AutonomousKernel.getInstance();
